import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus } from "@prisma/client";
import { payphoneRequestWithRetry } from "@/lib/payphoneClient";
import { finalizeSale } from "@/lib/finalizeSale";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
        const rl = await rateLimit(`confirm:${ip}`, 10, 60);
        if (!rl.success) {
            return NextResponse.json({ ok: false, error: 'Demasiados intentos. Por favor espere.' }, { status: 429 });
        }

        const body = await req.json();
        // Support both PayPhone format (id/clientTransactionId) and direct polling (saleId)
        const id = body?.id ? String(body.id) : undefined;
        const clientTransactionId = body?.clientTransactionId;
        const saleId = body?.saleId;

        console.log(`[CONFIRM_API] Processing: id=${id}, clientTxId=${clientTransactionId}, saleId=${saleId}`);

        // 1. Sale ID Cleanup
        const effectiveSaleId = (saleId && saleId !== "0") ? saleId : undefined;

        // 2. Find the sale (try effectiveSaleId, then clientTransactionId, then payphonePaymentId as fallback)
        let sale = await prisma.sale.findFirst({
            where: effectiveSaleId ? { id: effectiveSaleId } : (clientTransactionId ? { clientTransactionId } : { payphonePaymentId: id }),
            include: { tickets: true }
        });

        // 3. Fallback to searching by PayPhone ID if provided and not found yet
        if (!sale && id) {
            sale = await prisma.sale.findFirst({
                where: { payphonePaymentId: id },
                include: { tickets: true }
            });
        }

        if (!sale) {
            console.error(`[CONFIRM_API] Sale not found for: saleId=${saleId}, clientTxId=${clientTransactionId}, payphoneId=${id}`);
            // Return 202 (Accepted/Pending) instead of 404 to avoid triggering releases/reversals on external systems
            return NextResponse.json({ ok: true, status: "pending", message: "sale not found yet" }, { status: 202 });
        }

        // Idempotency check: if already PAID, finalizeSale will handle it
        if (sale.status === SaleStatus.PAID && (sale.tickets?.length || 0) > 0) {
            return NextResponse.json({
                ok: true,
                alreadyPaid: true,
                saleId: sale.id,
                numbers: sale.tickets.map(t => t.number)
            });
        }

        // If it's a PayPhone confirmation (has PayPhone ID), we MUST verify with PayPhone
        if (id) {
            const result = await payphoneRequestWithRetry({
                method: 'POST',
                url: '/button/V2/Confirm',
                data: {
                    id: id,
                    clientTxId: sale.clientTransactionId
                }
            });

            if (!result.ok) {
                console.error(`[CONFIRM_API] PayPhone verification failed for sale ${sale.id}:`, result.status);
                return NextResponse.json({
                    ok: false,
                    error: "PayPhone Confirm failed",
                    status: result.status
                }, { status: 502 });
            }

            const data = result.data;
            if (data.statusCode !== 3) {
                console.log(`[CONFIRM_API] Sale ${sale.id} not paid in PayPhone. Status: ${data.statusCode}`);
                // Optional: handle CANCELED (statusCode 2) if needed, but finalizeSale is only for success
                return NextResponse.json({
                    ok: false,
                    error: "PAYMENT_NOT_APPROVED",
                    statusCode: data.statusCode
                }, { status: 400 });
            }

            // At this point PayPhone confirmed PAID (3), so we sync our DB
            // We can update PayPhone metadata here before finalizeSale
            await prisma.sale.update({
                where: { id: sale.id },
                data: {
                    payphonePaymentId: String(id),
                    payphoneAuthorizationCode: String(data.authorizationCode || ''),
                    payphoneStatusCode: data.statusCode,
                } as any
            });
        }

        // Finalize the sale (promote tickets, mark PAID, send email)
        const done = await finalizeSale(sale.id);

        return NextResponse.json({
            ok: true,
            saleId: sale.id,
            numbers: done.numbers,
            emailed: done.emailed,
            idempotent: done.idempotent
        });

    } catch (error: any) {
        console.error('[PayPhone Confirm API] Error:', error);
        const status = error.status || 500;
        return NextResponse.json({
            ok: false,
            error: error.message || "INTERNAL_ERROR"
        }, { status });
    }
}
