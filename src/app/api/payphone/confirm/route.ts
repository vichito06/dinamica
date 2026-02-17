
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus, TicketStatus } from "@prisma/client";
import { payphoneRequestWithRetry } from "@/lib/payphoneClient";
import { sendTicketsEmail } from "@/lib/email";
import { recoverTicketNumbers } from "@/lib/ticketNumbersRecovery";

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
            include: {
                tickets: { orderBy: { number: 'asc' } },
                customer: true
            }
        });

        if (!sale) {
            console.error(`[PayPhone Confirm] Sale not found for clientTxId: ${clientTransactionId}`);
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        // Idempotency: Si ya está pagada, retornar ok + tickets sin reprocesar
        if (sale.status === SaleStatus.PAID) {
            const pad4 = (num: number | string) => String(num).padStart(4, '0');

            // 0) Intentar snapshot guardado en Sale
            let finalTickets: string[] = (sale as any).ticketNumbers || [];

            // 1) Si no hay snapshot, reconstruir desde ración de Tickets (SOLD)
            if (finalTickets.length === 0) {
                const tickets = await prisma.ticket.findMany({
                    where: { saleId: sale.id, status: TicketStatus.SOLD },
                    orderBy: { number: 'asc' }
                });
                finalTickets = tickets.map(t => pad4(t.number));

                // Opcional: Re-snapshot si estaba vacío para agilizar futuros hits
                if (finalTickets.length > 0) {
                    await prisma.sale.update({
                        where: { id: sale.id },
                        data: { ticketNumbers: finalTickets }
                    });
                }
            } else {
                // Asegurar formato pad4 y orden
                finalTickets = finalTickets.map((n: string) => pad4(n)).sort();
            }

            return NextResponse.json({
                ok: true,
                alreadyPaid: true,
                statusCode: 3,
                saleId: sale.id,
                ticketNumbers: finalTickets,
                emailSent: true
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, max-age=0'
                }
            });
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

        let ticketNumbers: string[] = sale.tickets.map(t => t.number.toString().padStart(4, '0'));
        let emailSent = false;

        if (isPaid) {
            await prisma.$transaction(async (tx) => {
                // 1. Update Sale with payout info and ticket snapshot
                await tx.sale.update({
                    where: { id: sale.id },
                    data: {
                        status: SaleStatus.PAID,
                        confirmedAt: new Date(),
                        payphoneStatusCode: data.statusCode,
                        payphoneAuthorizationCode: String(data.authorizationCode || ''),
                        ticketNumbers: ticketNumbers // Snapshot
                    }
                });

                // 2. Mark as SOLD (only if currently RESERVED)
                await tx.ticket.updateMany({
                    where: {
                        saleId: sale.id,
                        status: TicketStatus.RESERVED
                    },
                    data: {
                        status: TicketStatus.SOLD,
                        sessionId: null,
                        reservedUntil: null
                    }
                });
            });
            console.log(`[PayPhone Confirm] Sale ${sale.id} confirmed as PAID`);

            // Intentar enviar correo con manejo de rate limit
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
                        data: { lastEmailSentAt: new Date() }
                    });
                } else {
                    console.warn(`[PayPhone Confirm] Email not sent: ${emailResult.error}`);
                }
            } catch (emailErr) {
                console.error("[PayPhone Confirm] Email sending failed:", emailErr);
                emailSent = false;
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
            console.warn(`[PayPhone Confirm] Sale ${sale.id} rejected/canceled (ST:${data.statusCode})`);
        }

        // Final response calculation for NEW payments
        let finalResponseTickets = ticketNumbers; // use local if we just processed it
        if (isPaid && finalResponseTickets.length === 0) {
            const recovery = await prisma.$transaction(async (tx) => {
                return await recoverTicketNumbers(tx, sale.id);
            });
            finalResponseTickets = recovery.numbers;
            console.log(`[PayPhone Confirm] Recovery for NEW payment: saleId=${sale.id} source=${recovery.source} tickets=${finalResponseTickets.length}`);
        }

        return new NextResponse(JSON.stringify({
            ok: true,
            status: data.status,
            statusCode: data.statusCode,
            saleId: sale.id,
            ticketNumbers: isPaid ? finalResponseTickets : [],
            emailSent: emailSent
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (error: any) {
        console.error('[PayPhone Confirm API] Crash:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

