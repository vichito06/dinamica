
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus, TicketStatus } from "@prisma/client";
import { payphoneRequestWithRetry } from "@/lib/payphoneClient";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, clientTransactionId } = body;

        if (!id || !clientTransactionId) {
            return NextResponse.json({ error: 'Missing id or clientTransactionId' }, { status: 400 });
        }

        const sale = await prisma.sale.findUnique({
            where: { clientTransactionId },
            include: { tickets: true }
        });

        if (!sale) {
            console.error(`[PayPhone Confirm] Sale not found for clientTxId: ${clientTransactionId}`);
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        // Idempotency: Si ya está pagada, retornar ok sin reprocesar
        if (sale.status === SaleStatus.PAID) {
            return NextResponse.json({ ok: true, alreadyPaid: true });
        }

        // Call PayPhone V2 Confirm using the Axios client
        const result = await payphoneRequestWithRetry({
            method: 'POST',
            url: '/button/V2/Confirm',
            data: {
                id: Number(id),
                clientTxId: clientTransactionId
            }
        });

        if (!result.ok) {
            const errorBody = result.isJson ? JSON.stringify(result.data) : (result.errorText || 'Unknown error');
            console.error(`[PayPhone Confirm] Request failed. Status: ${result.status}. Body: ${errorBody.slice(0, 500)}`);

            return NextResponse.json({
                ok: false,
                error: "PayPhone Confirm failed",
                status: result.status
            }, { status: 502 });
        }

        const data = result.data;
        // statusCode 3 = Approved, 2 = Canceled/Fail
        const isPaid = data.statusCode === 3;
        const isCanceled = data.statusCode === 2;

        if (isPaid) {
            await prisma.$transaction([
                prisma.sale.update({
                    where: { id: sale.id },
                    data: {
                        status: SaleStatus.PAID,
                        confirmedAt: new Date(),
                        payphoneStatusCode: data.statusCode,
                        payphoneAuthorizationCode: String(data.authorizationCode || '')
                    }
                }),
                prisma.ticket.updateMany({
                    where: { saleId: sale.id },
                    data: { status: TicketStatus.SOLD }
                })
            ]);
            console.log(`[PayPhone Confirm] Sale ${sale.id} confirmed as PAID`);
        } else if (isCanceled) {
            await prisma.$transaction([
                prisma.sale.update({
                    where: { id: sale.id },
                    data: { status: SaleStatus.CANCELED }
                }),
                prisma.ticket.updateMany({
                    where: { saleId: sale.id },
                    data: { status: TicketStatus.AVAILABLE, saleId: null, reservedUntil: null }
                })
            ]);
            console.warn(`[PayPhone Confirm] Sale ${sale.id} rejected/canceled (ST:${data.statusCode})`);
        }

        return NextResponse.json({
            ok: true,
            status: data.status,
            statusCode: data.statusCode
        });

    } catch (error: any) {
        console.error('[PayPhone Confirm API] Crash:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

