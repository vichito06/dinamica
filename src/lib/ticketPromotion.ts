import { TicketStatus } from "@prisma/client";

/**
 * Ensures that all requested numbers for a sale are created and marked as SOLD.
 * This is the definitive law to avoid "ghost sales" where money is received 
 * but no tickets are assigned.
 */
export async function promoteTicketsForSale(tx: any, saleId: string) {
    const sale = await tx.sale.findUnique({
        where: { id: saleId },
        select: { id: true, raffleId: true, requestedNumbers: true },
    });

    if (!sale) throw new Error(`Sale not found: ${saleId}`);
    if (!sale.raffleId) throw new Error(`Sale ${saleId} does not have a linked raffleId`);

    const requestedNumbers = (sale.requestedNumbers as any[]) || [];
    const numbers = requestedNumbers.map(Number).filter(n => !isNaN(n));

    if (!numbers.length) {
        throw new Error(`[PROMOTE] Sale ${saleId} has no requestedNumbersSnapshot (Snapshot is mandatory)`);
    }

    console.log(`[PROMOTE] Promoting ${numbers.length} tickets for sale ${saleId} in raffle ${sale.raffleId}`);

    // 1) Identify missing tickets (that don't exist in the Ticket table at all for this raffle)
    const existing = await tx.ticket.findMany({
        where: { raffleId: sale.raffleId, number: { in: numbers } },
        select: { number: true },
    });
    const have = new Set(existing.map((t: any) => t.number));
    const missing = numbers.filter(n => !have.has(n));

    let createdCount = 0;
    if (missing.length) {
        console.log(`[PROMOTE] Creating ${missing.length} missing tickets for raffle ${sale.raffleId}`);
        const result = await tx.ticket.createMany({
            data: missing.map(n => ({
                raffleId: sale.raffleId as string,
                number: n,
                status: TicketStatus.SOLD,
                saleId: sale.id,
                soldAt: new Date(),
            })),
            skipDuplicates: true,
        });
        createdCount = result.count;
    }

    // 2) Update all relevant tickets (existing ones that are not SOLD yet, or are already SOLD to this sale)
    // We update all to ensure they are properly linked and marked as SOLD at this moment.
    // However, we MUST NOT hijack tickets that are SOLD to ANOTHER sale.
    const updateResult = await tx.ticket.updateMany({
        where: {
            raffleId: sale.raffleId,
            number: { in: numbers },
            OR: [
                { status: { not: TicketStatus.SOLD } },
                { saleId: sale.id }
            ]
        },
        data: {
            status: TicketStatus.SOLD,
            saleId: sale.id,
            soldAt: new Date(),
            reservedUntil: null,
            sessionId: null
        },
    });

    const promotedCount = createdCount + updateResult.count;
    console.log(`[PROMOTE] Success: ${promotedCount}/${numbers.length} tickets promoted for sale ${saleId}`);

    if (promotedCount < numbers.length) {
        const missingCount = numbers.length - promotedCount;
        const msg = `GHOST_SALE_ERROR: No se pudieron promover ${missingCount} de ${numbers.length} tickets. Posible conflicto de reserva o venta duplicada.`;
        console.error(`[PROMOTE] FATAL: ${msg} | saleId=${saleId}`);
        throw new Error(msg);
    }

    const finalNumbers = numbers.map(n => String(n).padStart(4, "0"));

    // 3) Snapshot final numbers in the Sale record
    await tx.sale.update({
        where: { id: sale.id },
        data: { ticketNumbers: finalNumbers } as any
    });

    return finalNumbers;
}
