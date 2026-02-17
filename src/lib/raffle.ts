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

        // Seed 9,999 tickets for the new raffle
        console.log(`[Raffle Lib] Seeding 9,999 tickets for raffle ${activeRaffle.id}...`);
        const ticketsData = Array.from({ length: 9999 }, (_, i) => ({
            number: i + 1,
            status: TicketStatus.AVAILABLE,
            raffleId: activeRaffle!.id
        }));

        await client.ticket.createMany({
            data: ticketsData,
            skipDuplicates: true
        });
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
