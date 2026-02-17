import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { count, sessionId } = await req.json();

        if (!count || typeof count !== 'number' || count < 1) {
            return NextResponse.json({ error: "Invalid count" }, { status: 400 });
        }
        if (!sessionId) {
            return NextResponse.json({ error: "sessionId required" }, { status: 400 });
        }

        console.log(`[Pick] Requesting ${count} tickets for session ${sessionId}`);

        // Atomic pick using raw SQL for SKIP LOCKED performance/safety
        const result = await prisma.$transaction(async (tx) => {
            // 1. Find available tickets and lock them
            // We use ORDER BY RANDOM() to give that "generar" feel
            const available: any[] = await tx.$queryRaw`
                SELECT id, "number"
                FROM "Ticket"
                WHERE "status" = 'AVAILABLE'
                ORDER BY RANDOM()
                LIMIT ${count}
                FOR UPDATE SKIP LOCKED
            `;

            if (available.length < count) {
                return { ok: false, found: available.length };
            }

            const ids = available.map(t => t.id);
            const ticketNumbers = available.map(t => t.number.toString().padStart(4, '0'));
            const reservedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            // 2. Mark as RESERVED
            await tx.ticket.updateMany({
                where: { id: { in: ids } },
                data: {
                    status: TicketStatus.RESERVED,
                    sessionId: sessionId,
                    reservedUntil: reservedUntil
                }
            });

            return { ok: true, ticketNumbers };
        });

        if (!result.ok) {
            return NextResponse.json({
                ok: false,
                error: "No hay suficientes tickets disponibles.",
                available: result.found
            }, { status: 409 });
        }

        return NextResponse.json({
            ok: true,
            ticketNumbers: result.ticketNumbers
        });

    } catch (error: any) {
        console.error("[Pick] ERROR:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
