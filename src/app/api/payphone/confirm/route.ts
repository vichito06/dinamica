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

        if (!id || !clientTransactionId) {
            return NextResponse.json({ ok: false, error: 'Missing id or clientTransactionId' }, { status: 400 });
        }

        const sale = await prisma.sale.findUnique({
            where: { clientTransactionId },
            select: { id: true, status: true, customer: true, amountCents: true, clientTransactionId: true }
        });

        if (!sale) {
            console.error(`[PayPhone Confirm] Sale not found for clientTxId: ${clientTransactionId}`);
            return NextResponse.json({ ok: false, error: 'Sale not found' }, { status: 404 });
        }

        // ✅ LEY 0 - CASO: YA PAID (Idempotency)
        if (sale.status === SaleStatus.PAID) {
            const rec = await prisma.$transaction(async (tx) => {
                return await recoverAndFixTicketNumbers(tx, sale.id);
            });

            if (!rec.ok) {
                console.error(`[PayPhone Confirm] BLOCKED: paidWithoutTickets saleId=${sale.id} error=${rec.reason}`);
                return NextResponse.json({
                    ok: false,
                    alreadyPaid: true,
                    error: rec.reason,
                    ticketNumbers: []
                }, { status: 500 });
            }

            return NextResponse.json({
                ok: true,
                alreadyPaid: true,
                statusCode: 3,
                saleId: sale.id,
                ticketNumbers: rec.ticketNumbers,
                source: rec.source,
                emailSent: true
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, max-age=0'
                }
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

        let ticketNumbers: string[] = [];
        let emailSent = false;

        if (isPaid) {
            // ✅ LEY 0 - CASO: PAGO NUEVO
            const recovery = await prisma.$transaction(async (tx) => {
                // Ejecutar recuperación y reparación (usando requestedNumbers si hace falta)
                const rec = await recoverAndFixTicketNumbers(tx, sale.id);

                if (!rec.ok) {
                    throw new Error(`GHOST_SALE_ERROR: No tickets found for sale ${sale.id} even with requestedNumbers.`);
                }

                // 1. Update Sale with payout info and ticket snapshot
                await tx.sale.update({
                    where: { id: sale.id },
                    data: {
                        status: SaleStatus.PAID,
                        confirmedAt: new Date(),
                        payphoneStatusCode: data.statusCode,
                        payphoneAuthorizationCode: String(data.authorizationCode || ''),
                        payphonePaymentId: String(id),
                        ticketNumbers: rec.ticketNumbers // Definitive Snapshot from Law 0
                    } as any
                });

                return rec;
            });

            ticketNumbers = recovery.ticketNumbers;
            console.log(`[PayphoneConfirm] saleId=${sale.id} source=${recovery.source} ticketCount=${ticketNumbers.length}`);

            // Email
            try {
                const emailResult = await sendTicketsEmail({
                    to: sale.customer.email,
                    customerName: `${sale.customer.firstName} ${sale.customer.lastName}`,
                    saleCode: sale.clientTransactionId.slice(-6).toUpperCase(),
                    tickets: ticketNumbers,
                    total: sale.amountCents / 100
                });
                emailSent = emailResult.success;
                if (emailSent) {
                    await prisma.sale.update({
                        where: { id: sale.id },
                        data: { lastEmailSentAt: new Date() } as any
                    });
                }
            } catch (emailErr) {
                console.error("[PayPhone Confirm] Email failed:", emailErr);
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
            ticketNumbers: isPaid ? ticketNumbers : [],
            emailSent: emailSent
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (error: any) {
        console.error('[PayPhone Confirm API] Crash:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
