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
 * Implementa la Ley de Atominicidad: Promote First -> Verify -> Mark PAID.
 */
export async function reconcileSale(saleId: string): Promise<ReconcileResult> {
    const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { customer: true }
    });

    if (!sale) {
        return { ok: false, status: 'NOT_FOUND', saleId, ticketNumbers: [], error: 'Sale not found' };
    }

    // 0. Si ya está PAID, intentar promover por si quedó en "Limbo" (Idempotencia)
    if (sale.status === SaleStatus.PAID) {
        try {
            const ticketNumbers = await prisma.$transaction(async (tx) => {
                return await promoteTicketsForSale(tx, sale.id);
            });

            // Si ya está pagado pero no se ha enviado el email, podemos intentar re-enviarlo aquí
            // (Opcional, pero robusto)
            return { ok: true, status: 'PAID', saleId: sale.id, ticketNumbers, alreadyPaid: true };
        } catch (err: any) {
            return { ok: true, status: 'PAID', saleId: sale.id, ticketNumbers: [], alreadyPaid: true, error: `Ya pagado, pero error al sincronizar tickets: ${err.message}` };
        }
    }

    if (!sale.payphonePaymentId || !sale.clientTransactionId) {
        return { ok: false, status: 'INCOMPLETE', saleId, ticketNumbers: [], error: 'Missing PayPhone data' };
    }

    // 1. Consultar PayPhone S2S (Definitivo)
    console.log(`[Reconcile] Querying PayPhone for sale ${sale.id}...`);
    const confirmResult: PayPhoneConfirmResult = await confirmPayphonePayment(sale.payphonePaymentId, sale.clientTransactionId);

    if (confirmResult.status === 'APPROVED') {
        try {
            // 2. Transacción Atómica de Blindaje
            const ticketNumbers = await prisma.$transaction(async (tx) => {
                console.log(`[Reconcile] Starting Atomic Transaction for sale ${sale.id}`);

                // a) PROMOCIÓN (Snapshot -> SOLD)
                // Esta función lanza error si no puede promover el 100%
                const promoted = await promoteTicketsForSale(tx, sale.id);

                // b) VERIFICACIÓN DE SEGURIDAD (Doble Check)
                const soldCount = await tx.ticket.count({
                    where: { saleId: sale.id, status: TicketStatus.SOLD }
                });

                if (soldCount === 0 || soldCount < sale.requestedNumbers.length) {
                    throw new Error(`CONCURRENCY_ERROR: Solo se encontraron ${soldCount} tickets vendidos de ${sale.requestedNumbers.length} solicitados.`);
                }

                // c) MARCADO PAID
                await tx.sale.update({
                    where: { id: sale.id },
                    data: {
                        status: SaleStatus.PAID,
                        confirmedAt: new Date(),
                        payphoneStatusCode: 3,
                        payphoneAuthorizationCode: confirmResult.transactionId || 'S2S',
                        lastError: null,
                        lastErrorAt: null
                    } as any
                });

                return promoted;
            }, { timeout: 25000 });

            console.log(`[Reconcile] SUCCESS: Sale ${sale.id} is now PAID with ${ticketNumbers.length} tickets.`);

            // 3. Email de Confirmación (Post-Transacción, Idempotente)
            if (sale.customer && !sale.lastEmailSentAt) {
                try {
                    console.log(`[EMAIL] Attempting confirm email for sale ${sale.id} to ${sale.customer.email}`);
                    await sendTicketsEmail({
                        to: sale.customer.email,
                        customerName: `${sale.customer.firstName} ${sale.customer.lastName}`,
                        idNumber: sale.customer.idNumber,
                        saleCode: sale.clientTransactionId.slice(-6).toUpperCase(),
                        saleId: sale.id,
                        tickets: ticketNumbers,
                        total: sale.amountCents / 100,
                        date: sale.confirmedAt || sale.createdAt
                    });

                    await prisma.sale.update({
                        where: { id: sale.id },
                        data: { lastEmailSentAt: new Date() } as any
                    });
                    console.log(`[EMAIL] SUCCESS for sale ${sale.id}`);
                } catch (e: any) {
                    console.error(`[EMAIL] FAILED for sale ${sale.id}:`, e.message);
                    await prisma.sale.update({
                        where: { id: sale.id },
                        data: { lastError: `EMAIL_FAILED: ${e.message}`, lastErrorAt: new Date() } as any
                    }).catch(() => { });
                }
            }

            return { ok: true, status: 'APPROVED', saleId: sale.id, ticketNumbers };

        } catch (error: any) {
            console.error(`[Reconcile] CRITICAL FAILURE for sale ${sale.id}:`, error.message);

            // Registrar el error en la venta para el Admin
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

/**
 * Reconcilia ventas PENDING de forma masiva (usado por el CRON)
 */
export async function reconcilePendingSales(options: { lookbackHours: number } = { lookbackHours: 24 }) {
    const twentyFourHoursAgo = new Date(Date.now() - options.lookbackHours * 60 * 60 * 1000);

    const pendingSales = await prisma.sale.findMany({
        where: {
            status: SaleStatus.PENDING,
            createdAt: { gte: twentyFourHoursAgo },
            payphonePaymentId: { not: null as any },
            clientTransactionId: { not: null as any }
        },
        take: 20
    });

    console.log(`[Reconcile Batch] Found ${pendingSales.length} candidates.`);

    const results = [];
    for (const sale of pendingSales) {
        try {
            const res = await reconcileSale(sale.id);
            results.push({ id: sale.id, status: res.status, ok: res.ok });
        } catch (e) {
            results.push({ id: sale.id, status: 'CRASH', ok: false });
        }
    }

    return {
        processedCount: pendingSales.length,
        results
    };
}
