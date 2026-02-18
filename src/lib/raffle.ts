import { prisma } from "./prisma";
import { TicketStatus, Raffle } from "@prisma/client";

/**
 * Gets the currently ACTIVE raffle.
 * If none exists, creates one and seeds 9,999 tickets.
 * @param tx Optional Prisma Transaction client
 */
export async function getActiveRaffle(tx?: any): Promise<Raffle> {
    const client = tx || prisma;

    let activeRaffle = await client.raffle.findFirst({
        where: { status: 'ACTIVE' }
    });

    if (!activeRaffle) {
        console.log("[Raffle Lib] No active raffle found. Creating initial raffle...");
        activeRaffle = await client.raffle.create({
            data: {
                name: "Dinamica 1",
                status: "ACTIVE"
            }
        });

        await ensureRaffleInventory(client, activeRaffle.id);
    } else {
        // Periodic or conditional check for inventory completeness
        // For robustness, we check if total tickets match expected range
        const count = await client.ticket.count({ where: { raffleId: activeRaffle.id } });
        if (count < 9999) {
            console.warn(`[Raffle Lib] Raffle ${activeRaffle.id} has partial inventory (${count}/9999). Repairing...`);
            await ensureRaffleInventory(client, activeRaffle.id);
        }
    }

    return activeRaffle;
}

/**
 * Helper to get only the ID of the active raffle.
 */
export async function getActiveRaffleId(tx?: any): Promise<string> {
    const raffle = await getActiveRaffle(tx);
    return raffle.id;
}

export async function ensureRaffleInventory(tx: any, raffleId: string) {
    const existing = await tx.ticket.findMany({
        where: { raffleId },
        select: { number: true }
    });
    const have = new Set(existing.map((t: any) => t.number));
    const missing: number[] = [];

    for (let n = 1; n <= 9999; n++) {
        if (!have.has(n)) missing.push(n);
    }

    if (missing.length > 0) {
        console.log(`[SEED] Backfilling ${missing.length} missing tickets for raffle ${raffleId}`);
        const chunks = [];
        for (let i = 0; i < missing.length; i += 1000) {
            chunks.push(missing.slice(i, i + 1000));
        }

        for (const chunk of chunks) {
            await tx.ticket.createMany({
                data: chunk.map(n => ({
                    raffleId,
                    number: n,
                    status: 'AVAILABLE'
                })),
                skipDuplicates: true
            });
        }
    }
    return missing.length;
}
