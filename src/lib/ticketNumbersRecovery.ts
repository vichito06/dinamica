import { PrismaClient, TicketStatus, SaleStatus } from "@prisma/client";

export async function recoverAndFixTicketNumbers(tx: any, saleId: string) {
    // 1) Leer venta con toda la evidencia
    const sale = await tx.sale.findUnique({
        where: { id: saleId },
        select: { id: true, ticketNumbers: true, requestedNumbers: true, status: true, raffleId: true },
    });

    if (!sale) {
        console.error(`[GHOST] saleId=${saleId} level=FAILED reason=SALE_NOT_FOUND`);
        return { ok: false as const, reason: "SALE_NOT_FOUND", ticketNumbers: [] as string[] };
    }

    const ticketNumbers = (sale as any).ticketNumbers || [];
    const requestedNumbers = (sale as any).requestedNumbers || [];
    const raffleId = sale.raffleId;

    const snapshotNorm = (Array.isArray(ticketNumbers) ? ticketNumbers : []).map((n: any) => String(n).padStart(4, "0"));
    const requestedNorm = (Array.isArray(requestedNumbers) ? requestedNumbers : []).map((n: any) => String(n).padStart(4, "0"));

    // ✅ TIER 1: [SNAPSHOT] Si Sale.ticketNumbers ya existe
    if (snapshotNorm.length > 0) {
        console.log(`[SNAPSHOT] saleId=${saleId} source=confirmed_snapshot count=${snapshotNorm.length}`);
        return { ok: true as const, source: "snapshot" as const, ticketNumbers: snapshotNorm };
    }

    // ✅ TIER 2: [PROMOTE] Si hay requestedNumbers (LEY 0)
    if (requestedNorm.length > 0 && raffleId) {
        const reservedStatus = (TicketStatus as any).RESERVED || "RESERVED";
        const targetStatus = sale.status === SaleStatus.PAID ? TicketStatus.SOLD : reservedStatus;

        console.log(`[PROMOTE] (Law 0) saleId=${saleId} requestedCount=${requestedNorm.length} targetStatus=${targetStatus}`);

        for (const numStr of requestedNorm) {
            const numInt = parseInt(numStr, 10);
            await tx.ticket.upsert({
                where: {
                    raffleId_number: { raffleId, number: numInt }
                },
                update: {
                    saleId: sale.id,
                    status: targetStatus,
                    sessionId: null,
                    reservedUntil: null
                },
                create: {
                    number: numInt,
                    raffleId: raffleId,
                    saleId: sale.id,
                    status: targetStatus,
                    reservedUntil: null
                }
            });
        }

        if (sale.status === SaleStatus.PAID) {
            await tx.sale.update({
                where: { id: sale.id },
                data: { ticketNumbers: requestedNorm } as any
            });
            console.log(`[SNAPSHOT] saleId=${saleId} finalized from requestedNumbers`);
        }

        return { ok: true as const, source: "requested_repaired" as const, ticketNumbers: requestedNorm };
    }

    // ✅ TIER 3: [PROMOTE] Fallback query Ticket por saleId (RESERVED, SOLD)
    const reservedStatus = (TicketStatus as any).RESERVED || "RESERVED";
    const tickets = await tx.ticket.findMany({
        where: {
            saleId,
            raffleId: raffleId || undefined,
            status: { in: [TicketStatus.SOLD, reservedStatus] },
        },
        select: { number: true, status: true },
        orderBy: { number: "asc" },
    });

    const nums = tickets.map((t: { number: number | string }) => String(t.number).padStart(4, "0"));

    if (nums.length === 0) {
        console.error(`[GHOST] saleId=${saleId} level=FAILED reason=NO_EVIDENCE`);
        return { ok: false as const, reason: "NO_TICKETS_FOR_SALE", ticketNumbers: [] as string[] };
    }

    const hasReserved = tickets.some((t: { status: any }) => t.status === reservedStatus);
    if (sale.status === SaleStatus.PAID && hasReserved) {
        console.log(`[PROMOTE] saleId=${saleId} status=PAID count=${nums.length} promoting RESERVED to SOLD`);
        await tx.ticket.updateMany({
            where: {
                saleId,
                status: reservedStatus,
                raffleId: raffleId || ''
            },
            data: { status: TicketStatus.SOLD, sessionId: null, reservedUntil: null },
        });
    }

    if (sale.status === SaleStatus.PAID) {
        await tx.sale.update({
            where: { id: sale.id },
            data: { ticketNumbers: nums } as any
        });
        console.log(`[SNAPSHOT] saleId=${saleId} finalized from linked tickets`);
    }

    return {
        ok: true as const,
        source: hasReserved ? ("repaired" as const) : ("tickets" as const),
        ticketNumbers: nums,
    };
}
