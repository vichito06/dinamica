import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { confirmText } = body;

        // Security check: simple confirm text for now, UI will handle double confirm
        if (confirmText !== 'RESETEAR') {
            return NextResponse.json({ ok: false, error: 'Confirmación inválida' }, { status: 400 });
        }

        // 1. Transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // A. Deactivate current raffles
            await tx.raffle.updateMany({
                where: { active: true },
                data: { active: false }
            });

            // B. Create new Raffle
            const newRaffle = await tx.raffle.create({
                data: {
                    name: `Dinamica ${new Date().toLocaleDateString()}`,
                    active: true
                }
            });

            // C. Recycle/Reset all 9999 tickets (0001 to 9999)
            // We assume 9999 tickets already exist in the DB from a previous initialization.
            // If they don't exist, we might need to seed them.
            // For now, we update existing ones.
            await tx.ticket.updateMany({
                data: {
                    status: TicketStatus.AVAILABLE,
                    saleId: null,
                    reservedUntil: null,
                    sessionId: null,
                    raffleId: newRaffle.id
                }
            });

            return newRaffle;
        });

        return NextResponse.json({
            ok: true,
            message: 'Rifa restablecida con éxito',
            newRaffle: result
        });

    } catch (error: any) {
        console.error('[Raffle Reset API Error]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
