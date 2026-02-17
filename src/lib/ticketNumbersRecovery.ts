import { PrismaClient, TicketStatus } from "@prisma/client";

// Omit problematic properties for transaction type
type PrismaTransaction = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function recoverTicketNumbers(tx: any, saleId: string) {
    const sale = await tx.sale.findUnique({
        where: { id: saleId },
        select: { ticketNumbers: true },
    });

    if (!sale) return { numbers: [], source: "none" as const, counts: { snapshot: 0, sold: 0, reserved: 0 } };

    // A) Snapshot - using casting to bypass Prisma drift on Sale model
    const snapshotNumbers = ((sale as any).ticketNumbers ?? []).map((n: string | number) => String(n).padStart(4, "0"));
    if (snapshotNumbers.length > 0) {
        return { numbers: snapshotNumbers, source: "snapshot" as const, counts: { snapshot: snapshotNumbers.length, sold: 0, reserved: 0 } };
    }

    // B) Tickets SOLD/RESERVED - handle potential HELD/RESERVED drift
    const reservedStatus = (TicketStatus as any).RESERVED || "RESERVED";
    const tickets = await tx.ticket.findMany({
        where: { saleId, status: { in: [TicketStatus.SOLD, reservedStatus] } },
        select: { number: true, status: true },
        orderBy: { number: "asc" },
    });

    const soldCount = tickets.filter((t: any) => t.status === TicketStatus.SOLD).length;
    const reservedCount = tickets.filter((t: any) => t.status === reservedStatus).length;

    if (tickets.length === 0) {
        return { numbers: [], source: "none" as const, counts: { snapshot: 0, sold: 0, reserved: 0 } };
    }

    const numbers = tickets.map((t: any) => String(t.number).padStart(4, "0"));

    // C) Repair RESERVED → SOLD + snapshot
    if (reservedCount > 0) {
        await tx.ticket.updateMany({
            where: { saleId, status: reservedStatus },
            data: { status: TicketStatus.SOLD, sessionId: null, reservedUntil: null },
        });

        await tx.sale.update({
            where: { id: saleId },
            data: { ticketNumbers: numbers },
        });

        return { numbers, source: "repaired" as const, counts: { snapshot: 0, sold: soldCount, reserved: reservedCount } };
    }

    return { numbers, source: "tickets" as const, counts: { snapshot: 0, sold: soldCount, reserved: reservedCount } };
}
