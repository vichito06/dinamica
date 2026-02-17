
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus, TicketStatus } from "@prisma/client";
import { payphoneRequestWithRetry } from "@/lib/payphoneClient";
import { sendTicketsEmail } from "@/lib/email";

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
            return NextResponse.json({
                ok: true,
                alreadyPaid: true,
                statusCode: 3,
                saleId: sale.id,
                ticketNumbers: sale.tickets.map(t => t.number.toString().padStart(4, '0')),
                emailSent: true // Assume sent if already paid
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
                // 1. Update Sale
                await tx.sale.update({
                    where: { id: sale.id },
                    data: {
                        status: SaleStatus.PAID,
                        confirmedAt: new Date(),
                        payphoneStatusCode: data.statusCode,
                        payphoneAuthorizationCode: String(data.authorizationCode || '')
                    }
                });

                // 2. Mark as SOLD (only if currently RESERVED)
                // We clear session and TTL data to indicate final ownership
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

            // Intentar enviar correo
            try {
                const emailResult = await sendTicketsEmail({
                    to: sale.customer.email,
                    customerName: `${sale.customer.firstName} ${sale.customer.lastName}`,
                    saleCode: sale.clientTransactionId.slice(-6).toUpperCase(),
                    tickets: ticketNumbers,
                    total: sale.amountCents / 100
                });
                emailSent = emailResult.success;
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
                    data: { status: TicketStatus.AVAILABLE, saleId: null, reservedUntil: null }
                })
            ]);
            console.warn(`[PayPhone Confirm] Sale ${sale.id} rejected/canceled (ST:${data.statusCode})`);
        }

        return NextResponse.json({
            ok: true,
            status: data.status,
            statusCode: data.statusCode,
            saleId: sale.id,
            ticketNumbers: isPaid ? ticketNumbers : [],
            emailSent: emailSent
        });

    } catch (error: any) {
        console.error('[PayPhone Confirm API] Crash:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

