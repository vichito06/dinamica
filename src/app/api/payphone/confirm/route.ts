import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus, TicketStatus } from "@prisma/client";
import { payphoneRequestWithRetry } from "@/lib/payphoneClient";
import { sendTicketsEmail } from "@/lib/email";
import { promoteTicketsForSale } from "@/lib/ticketPromotion";
import { getActiveRaffleId } from "@/lib/raffle";

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

        const sale = await prisma.sale.findFirst({
            where: { clientTransactionId },
            select: { id: true, status: true, customer: true, amountCents: true, clientTransactionId: true, raffleId: true }
        });

        if (!sale) {
            console.error(`[GHOST] Sale not found for clientTxId: ${clientTransactionId}`);
            return NextResponse.json({ ok: false, error: 'Sale not found' }, { status: 404 });
        }

        if (sale.status === SaleStatus.PAID) {
            try {
                const ticketNumbers = await prisma.$transaction(async (tx) => {
                    return await promoteTicketsForSale(tx, sale.id);
                });

                return NextResponse.json({
                    ok: true,
                    alreadyPaid: true,
                    statusCode: 3,
                    saleId: sale.id,
                    ticketNumbers: ticketNumbers,
                    source: "idempotency_promote"
                }, {
                    headers: { 'Cache-Control': 'no-store, max-age=0' }
                });
            } catch (err: any) {
                console.error(`[CONFIRM] Idempotency promotion failed for sale ${sale.id}:`, err.message);
                return NextResponse.json({
                    ok: false,
                    alreadyPaid: true,
                    code: 'PROMOTION_FAILED',
                    saleId: sale.id,
                    error: err.message
                }, { status: 500 });
            }
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
            // ✅ LEY 0 - ESTRATEGIA A: PROMOVER PRIMERO
            try {
                const payload = await prisma.$transaction(async (tx) => {
                    // 1. [L0] Promote tickets to SOLD definitively
                    // Si falla (ej: números robados), lanzará GHOST_SALE_ERROR y hará rollback
                    const ticketNumbers = await promoteTicketsForSale(tx, sale.id);

                    // 2. [Snapshot] Update Sale status to PAID
                    const updatedSale = await tx.sale.update({
                        where: { id: sale.id },
                        data: {
                            status: SaleStatus.PAID,
                            confirmedAt: new Date(),
                            payphoneStatusCode: data.statusCode,
                            payphoneAuthorizationCode: String(data.authorizationCode || ''),
                            payphonePaymentId: String(id),
                        } as any,
                        include: { customer: true }
                    });

                    return { sale: updatedSale, ticketNumbers };
                }, { timeout: 15000 });

                const ticketNumbers = payload.ticketNumbers;
                const customer = payload.sale.customer;
                console.log(`[CONFIRM] SUCCESS: saleId=${sale.id} status=PAID ticketCount=${ticketNumbers.length}`);

                // Email (best effort)
                try {
                    await sendTicketsEmail({
                        to: customer.email,
                        customerName: `${customer.firstName} ${customer.lastName}`,
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
                    statusCode: 3,
                    saleId: sale.id,
                    ticketNumbers: ticketNumbers,
                });

            } catch (error: any) {
                console.error(`[CONFIRM] FATAL ERROR for sale ${sale.id}:`, error.message);

                // Guardar error en la venta para auditoría admin
                await prisma.sale.update({
                    where: { id: sale.id },
                    data: {
                        lastError: error.message,
                        lastErrorAt: new Date()
                    } as any
                }).catch(e => console.error("[AUDIT] Falló al guardar error en DB:", e));

                if (error.message.includes('GHOST_SALE_ERROR')) {
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
                    where: {
                        saleId: sale.id,
                        raffleId: sale.raffleId || ''
                    },
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
