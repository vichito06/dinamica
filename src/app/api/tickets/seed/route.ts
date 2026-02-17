export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { TicketStatus } from "@prisma/client";

export async function POST(req: Request) {
    try {
        const { secret } = await req.json().catch(() => ({}));

        // Security check against environment variable
        if (!process.env.TICKETS_SEED_SECRET || secret !== process.env.TICKETS_SEED_SECRET) {
            return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        // Get Active Raffle
        const raffle = await prisma.raffle.findFirst({ where: { status: 'ACTIVE' } });
        if (!raffle) {
            return Response.json({ ok: false, error: "No active raffle" }, { status: 404 });
        }

        const existing = await prisma.ticket.count({ where: { raffleId: raffle.id } });
        if (existing > 0) {
            // If tickets exist, we don't overwrite to prevent data loss
            return Response.json({ ok: true, message: "already seeded", existing });
        }

        // Generate 9999 tickets (0001 to 9999)
        // Note: Database schema expects Int for 'number'
        const data = Array.from({ length: 9999 }, (_, i) => ({
            number: i + 1,
            status: TicketStatus.AVAILABLE,
            raffleId: raffle.id
        }));

        let inserted = 0;
        const chunkSize = 1000;

        // Chunked insertion for memory efficiency and safety
        for (let i = 0; i < data.length; i += chunkSize) {
            const part = data.slice(i, i + chunkSize);
            const res = await prisma.ticket.createMany({
                data: part,
                skipDuplicates: true
            });
            inserted += res.count;
        }

        console.log(`[tickets/seed] Successfully inserted ${inserted} tickets.`);
        return Response.json({ ok: true, inserted });

    } catch (e: any) {
        console.error("[tickets/seed] ERROR:", e);
        return Response.json({ ok: false, error: e?.message ?? "Internal error" }, { status: 500 });
    }
}
