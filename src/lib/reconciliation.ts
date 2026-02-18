import { prisma } from "./prisma";
import { SaleStatus, TicketStatus } from "@prisma/client";
import { confirmPayphonePayment, PayPhoneConfirmResult } from "./payphoneConfirm";
import { promoteTicketsForSale } from "./ticketPromotion";
import { sendTicketsEmail } from "./email";

export interface ReconcileResult {
    ok: boolean;
    status: string;
    saleId: string;
    ticketNumbers: string[];
    error?: string;
    alreadyPaid?: boolean;
}

/**
 * Reconcilia una venta individual con PayPhone.
 * Implementa la estrategia Promote-First.
 */
export async function reconcileSale(saleId: string): Promise<ReconcileResult> {
    const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { customer: true }
    });

    if (!sale) {
        return { ok: false, status: 'NOT_FOUND', saleId, ticketNumbers: [], error: 'Sale not found' };
    }

    if (sale.status === SaleStatus.PAID) {
        // Idempotencia: Intentar promover si por alguna razón no se hizo
        try {
            const ticketNumbers = await prisma.$transaction(async (tx) => {
                return await promoteTicketsForSale(tx, sale.id);
            });
            return { ok: true, status: 'PAID', saleId: sale.id, ticketNumbers, alreadyPaid: true };
        } catch (err: any) {
            return { ok: true, status: 'PAID', saleId: sale.id, ticketNumbers: [], alreadyPaid: true, error: err.message };
        }
    }

    if (!sale.payphonePaymentId || !sale.clientTransactionId) {
        return { ok: false, status: 'INCOMPLETE', saleId, ticketNumbers: [], error: 'Missing PayPhone data' };
    }

    // 1. Consultar PayPhone S2S
    const confirmResult: PayPhoneConfirmResult = await confirmPayphonePayment(sale.payphonePaymentId, sale.clientTransactionId);

    if (confirmResult.status === 'APPROVED') {
        try {
            // 2. Transacción Promote-First
            const ticketNumbers = await prisma.$transaction(async (tx) => {
                // a) Asegurar tickets
                const promoted = await promoteTicketsForSale(tx, sale.id);

                // b) Marcar PAID
                await tx.sale.update({
                    where: { id: sale.id },
                    data: {
                        status: SaleStatus.PAID,
                        confirmedAt: new Date(),
                        payphoneStatusCode: 3,
                        payphoneAuthorizationCode: confirmResult.transactionId || 'S2S'
                    } as any
                });

                return promoted;
            }, { timeout: 20000 });

            console.log(`[Reconcile] SUCCESS for sale ${sale.id}. Tickets: ${ticketNumbers.length}`);

            // 3. Email (Best effort)
            if (sale.customer) {
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
                } catch (e) {
                    console.error(`[Reconcile] Email failed for sale ${sale.id}:`, e);
                }
            }

            return { ok: true, status: 'APPROVED', saleId: sale.id, ticketNumbers };

        } catch (error: any) {
            console.error(`[Reconcile] Promotion failed for sale ${sale.id}:`, error.message);
            await prisma.sale.update({
                where: { id: sale.id },
                data: { lastError: error.message, lastErrorAt: new Date() } as any
            }).catch(() => { });

            return { ok: false, status: 'ERROR', saleId: sale.id, ticketNumbers: [], error: error.message };
        }
    } else if (confirmResult.status === 'REJECTED' || confirmResult.status === 'CANCELED') {
        // Opcional: Liberar tickets si fue rechazado
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
        return { ok: true, status: confirmResult.status, saleId: sale.id, ticketNumbers: [] };
    }

    return { ok: true, status: confirmResult.status, saleId: sale.id, ticketNumbers: [] };
}
