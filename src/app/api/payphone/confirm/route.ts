import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus, TicketStatus } from "@prisma/client";
import { payphoneRequestWithRetry } from "@/lib/payphoneClient";
import { sendTicketsEmail } from "@/lib/email";
import { recoverAndFixTicketNumbers } from "@/lib/ticketNumbersRecovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, clientTransactionId } = body;

        // Maintain PayPhone compatibility: strictly id and clientTransactionId
        if (!id || !clientTransactionId) {
            return NextResponse.json({ ok: false, error: 'Missing id or clientTransactionId' }, { status: 400 });
        }

        const sale = await prisma.sale.findUnique({
            where: { clientTransactionId },
            select: { id: true, status: true, customer: true, amountCents: true, clientTransactionId: true }
        });

        if (!sale) {
            console.error(`[GHOST] Sale not found for clientTxId: ${clientTransactionId}`);
            return NextResponse.json({ ok: false, error: 'Sale not found' }, { status: 404 });
        }

        // ✅ LEY 0 - CASO: YA PAID (Idempotency)
        if (sale.status === SaleStatus.PAID) {
            const rec = await prisma.$transaction(async (tx) => {
                return await recoverAndFixTicketNumbers(tx, sale.id);
            });

            if (!rec.ok) {
                console.error(`[GHOST] Sale already PAID but irrecoverable: ${sale.id}`);
                return NextResponse.json({
                    ok: false,
                    alreadyPaid: true,
                    code: 'GHOST_SALE',
                    saleId: sale.id,
                    ticketNumbers: []
                }, { status: 500 });
            }

            return NextResponse.json({
                ok: true,
                alreadyPaid: true,
                statusCode: 3,
                saleId: sale.id,
                ticketNumbers: rec.ticketNumbers,
                source: rec.source
            }, {
                headers: { 'Cache-Control': 'no-store, max-age=0' }
            });
        }

        // Call PayPhone V2 Confirm
        const result = await payphoneRequestWithRetry({
            method: 'POST',
            url: '/button/V2/Confirm',
            data: {
                id: Number(id),
                clientTxId: clientTransactionId
            }
        });

        if (!result.ok) {
            return NextResponse.json({
                ok: false,
                error: "PayPhone Confirm failed",
                status: result.status
            }, { status: 502 });
        }

        const data = result.data;
        const isPaid = data.statusCode === 3;
        const isCanceled = data.statusCode === 2;

        if (isPaid) {
            // ✅ LEY 0 - CASO: PAGO NUEVO -> Validar Tickets antes de marcar PAID
            try {
                const recoveryResult = await prisma.$transaction(async (tx) => {
                    // 1. Intentar recuperar/reparar tickets
                    const rec = await recoverAndFixTicketNumbers(tx, sale.id);

                    if (!rec.ok) {
                        // [GHOST] Abortar transacción si no hay evidencia
                        throw new Error(`GHOST_SALE_ERROR:${rec.reason}`);
                    }

                    // 2. [SNAPSHOT] Guardar estado PAID y números en la MISMA transacción
                    await tx.sale.update({
                        where: { id: sale.id },
                        data: {
                            status: SaleStatus.PAID,
                            confirmedAt: new Date(),
                            payphoneStatusCode: data.statusCode,
                            payphoneAuthorizationCode: String(data.authorizationCode || ''),
                            payphonePaymentId: String(id),
                            ticketNumbers: rec.ticketNumbers // Snapshot definitivo
                        } as any
                    });

                    return rec;
                }, { timeout: 15000 });

                const ticketNumbers = recoveryResult.ticketNumbers;
                console.log(`[SNAPSHOT] saleId=${sale.id} status=PAID ticketCount=${ticketNumbers.length}`);

                // Email (best effort)
                try {
                    await sendTicketsEmail({
                        to: sale.customer.email,
                        customerName: `${sale.customer.firstName} ${sale.customer.lastName}`,
                        saleCode: sale.clientTransactionId.slice(-6).toUpperCase(),
                        tickets: ticketNumbers,
                        total: sale.amountCents / 100
                    });
                    await prisma.sale.update({
                        where: { id: sale.id },
                        data: { lastEmailSentAt: new Date() } as any
                    });
                } catch (emailErr) {
                    console.error("[Email] Failed but sale is PAID:", emailErr);
                }

                return NextResponse.json({
                    ok: true,
                    alreadyPaid: false,
                    saleId: sale.id,
                    ticketNumbers: ticketNumbers,
                });

            } catch (error: any) {
                if (error.message.startsWith('GHOST_SALE_ERROR')) {
                    console.error(`[GHOST] saleId=${sale.id} error=${error.message}`);
                    return NextResponse.json({
                        ok: false,
                        code: 'GHOST_SALE',
                        saleId: sale.id,
                        error: error.message
                    }, { status: 409 });
                }
                throw error; // Re-throw for general catch
            }
        } else if (isCanceled) {
            await prisma.$transaction([
                prisma.sale.update({
                    where: { id: sale.id },
                    data: { status: SaleStatus.CANCELED }
                }),
                prisma.ticket.updateMany({
                    where: { saleId: sale.id },
                    data: { status: TicketStatus.AVAILABLE, saleId: null, reservedUntil: null, sessionId: null }
                })
            ]);
        }

        return NextResponse.json({
            ok: true,
            status: data.status,
            statusCode: data.statusCode,
            saleId: sale.id,
            ticketNumbers: []
        });

    } catch (error: any) {
        console.error('[PayPhone Confirm API] Crash:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
