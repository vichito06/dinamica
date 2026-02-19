import { prisma } from "./prisma";
import { sendSaleEmail } from "./email";
import { SaleStatus, TicketStatus } from "@prisma/client";

function normalizeNumbers(input: any): number[] {
    if (!input) return [];
    if (Array.isArray(input)) return input.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    if (typeof input === "string") {
        try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) return parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
        } catch { }
    }
    return [];
}

function httpError(status: number, message: string) {
    const err: any = new Error(message);
    err.status = status;
    return err;
}

export async function finalizeSale(saleId: string) {
    const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
            customer: true,
            tickets: { select: { number: true }, orderBy: { number: "asc" } },
        },
    });

    if (!sale) throw httpError(404, "SALE_NOT_FOUND");

    // ✅ Idempotencia: si ya está PAID y ya tiene tickets, devolvemos y NO reenviamos email
    if (sale.status === SaleStatus.PAID && (sale.tickets?.length || 0) > 0) {
        return {
            ok: true,
            numbers: sale.tickets.map((t) => t.number),
            emailed: false,
            idempotent: true
        };
    }

    const numbers =
        normalizeNumbers(sale.ticketNumbers).length
            ? normalizeNumbers(sale.ticketNumbers)
            : normalizeNumbers(sale.requestedNumbers);

    if (!numbers.length) {
        console.error(`[FINALIZE] Sale ${saleId} has no numbers payload`, {
            ticketNumbers: sale.ticketNumbers,
            requestedNumbers: sale.requestedNumbers
        });
        throw httpError(409, "NO_REQUESTED_NUMBERS");
    }

    const sorted = [...numbers].sort((a, b) => a - b);

    // ✅ Transacción atómica
    const result = await prisma.$transaction(async (tx) => {
        // Encontrar raffleId si no está en la venta (lo buscamos de un ticket o del estado)
        const raffleId = sale.raffleId;
        if (!raffleId) throw httpError(409, "RAFFLE_ID_MISSING");

        const updateTickets = await tx.ticket.updateMany({
            where: {
                raffleId: raffleId,
                number: { in: sorted },
                status: { in: [TicketStatus.RESERVED, TicketStatus.AVAILABLE] },
            },
            data: {
                status: TicketStatus.SOLD,
                saleId: sale.id,
                // customerId: sale.customerId, // CustomerId is NOT in Ticket model based on schema
                soldAt: new Date(),
            },
        });

        if (updateTickets.count !== sorted.length) {
            console.error(`[FINALIZE] Ticket count mismatch for sale ${saleId}: expected ${sorted.length}, got ${updateTickets.count}`);
            // No todos estaban disponibles/reservados como se esperaba
            throw httpError(409, "TICKETS_NOT_AVAILABLE");
        }

        await tx.sale.update({
            where: { id: sale.id },
            data: {
                status: SaleStatus.PAID,
                confirmedAt: new Date(),
            },
        });

        const linked = await tx.ticket.findMany({
            where: { saleId: sale.id },
            select: { number: true },
            orderBy: { number: "asc" },
        });

        return linked.map((t: { number: number }) => t.number);
    }, { timeout: 15000 });

    // ✅ Email: se envía solo cuando realmente finalizamos (no en idempotent)
    console.log(`[FINALIZE] Success for sale ${saleId}, sending email...`);
    await sendSaleEmail(sale.id);

    return {
        ok: true,
        numbers: result,
        emailed: true,
        idempotent: false
    };
}
