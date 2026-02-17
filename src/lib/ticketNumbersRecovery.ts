import { PrismaClient, TicketStatus, SaleStatus } from "@prisma/client";

// Omit problematic properties for transaction type
type Tx = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function recoverAndFixTicketNumbers(tx: any, saleId: string) {
    // 1) Leer venta con toda la evidencia
    const sale = await tx.sale.findUnique({
        where: { id: saleId },
        select: { id: true, ticketNumbers: true, requestedNumbers: true, status: true },
    });

    if (!sale) {
        return { ok: false as const, reason: "SALE_NOT_FOUND", ticketNumbers: [] as string[] };
    }

    // Handle possible property absence or different types with any casting
    const ticketNumbers = (sale as any).ticketNumbers || [];
    const requestedNumbers = (sale as any).requestedNumbers || [];

    const snapshotNorm = (Array.isArray(ticketNumbers) ? ticketNumbers : []).map((n: any) => String(n).padStart(4, "0"));
    const requestedNorm = (Array.isArray(requestedNumbers) ? requestedNumbers : []).map((n: any) => String(n).padStart(4, "0"));

    // ✅ PRIORIDAD A: Si Sale.ticketNumbers ya existe, listo (ya pagado y guardado)
    if (snapshotNorm.length > 0) {
        return { ok: true as const, source: "snapshot" as const, ticketNumbers: snapshotNorm };
    }

    // ✅ PRIORIDAD B: Si ticketNumbers está vacío pero requestedNumbers tiene datos (LEY 0)
    if (requestedNorm.length > 0) {
        const reservedStatus = (TicketStatus as any).RESERVED || "RESERVED";
        const targetStatus = sale.status === SaleStatus.PAID ? TicketStatus.SOLD : reservedStatus;

        console.log(`[TicketRecovery] saleId=${saleId} source=requested_numbers requestedCount=${requestedNorm.length} targetStatus=${targetStatus}`);

        // Re-vincular y reparar los tickets basados en la selección original
        for (const numStr of requestedNorm) {
            const numInt = parseInt(numStr, 10);
            await tx.ticket.upsert({
                where: { number: numInt },
                update: {
                    saleId: sale.id,
                    status: targetStatus,
                    sessionId: null,
                    reservedUntil: null
                },
                create: {
                    number: numInt,
                    saleId: sale.id,
                    status: targetStatus,
                    reservedUntil: null
                }
            });
        }

        // Si la venta ya está pagada, actualizar el snapshot final
        if (sale.status === SaleStatus.PAID) {
            await tx.sale.update({
                where: { id: sale.id },
                data: { ticketNumbers: requestedNorm } as any
            });
        }

        return { ok: true as const, source: "requested_repaired" as const, ticketNumbers: requestedNorm };
    }

    // ✅ PRIORIDAD C: Fallback absoluto (buscar por saleId en la tabla Ticket)
    const reservedStatus = (TicketStatus as any).RESERVED || "RESERVED";
    const tickets = await tx.ticket.findMany({
        where: {
            saleId,
            status: { in: [TicketStatus.SOLD, reservedStatus] },
        },
        select: { number: true, status: true },
        orderBy: { number: "asc" },
    });

    const nums = tickets.map((t: { number: number | string }) => String(t.number).padStart(4, "0"));

    if (nums.length === 0) {
        // ❌ ghost sale: PAID sin evidencia de ningún tipo
        return { ok: false as const, reason: "NO_TICKETS_FOR_SALE", ticketNumbers: [] as string[] };
    }

    // Repair si hay RESERVED en una venta PAID
    const hasReserved = tickets.some((t: { status: any }) => t.status === reservedStatus);
    if (sale.status === SaleStatus.PAID && hasReserved) {
        await tx.ticket.updateMany({
            where: { saleId, status: reservedStatus },
            data: { status: TicketStatus.SOLD, sessionId: null, reservedUntil: null },
        });
    }

    // Guardar snapshot definitivo si está pagada
    if (sale.status === SaleStatus.PAID) {
        await tx.sale.update({
            where: { id: sale.id },
            data: { ticketNumbers: nums } as any
        });
    }

    return {
        ok: true as const,
        source: hasReserved ? ("repaired" as const) : ("tickets" as const),
        ticketNumbers: nums,
    };
}
