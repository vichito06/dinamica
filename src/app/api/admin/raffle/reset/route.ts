import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { confirmText, name } = body;

        if (confirmText !== "RESETEAR") {
            return NextResponse.json({ ok: false, error: 'Confirmación inválida' }, { status: 400 });
        }

        const newRaffleName = name || `Sorteo ${new Date().toLocaleDateString()}`;

        const newRaffle = await prisma.$transaction(async (tx) => {
            // 1. Close current active raffles
            await tx.raffle.updateMany({
                where: { status: 'ACTIVE' },
                data: { status: 'CLOSED' }
            });

            // 2. Create new ACTIVE raffle
            const raffle = await tx.raffle.create({
                data: {
                    name: newRaffleName,
                    status: 'ACTIVE'
                }
            });

            // 3. Seed 9,999 tickets for the new raffle
            // Using createMany for performance
            const ticketsData = Array.from({ length: 9999 }, (_, i) => ({
                number: i + 1,
                status: 'AVAILABLE' as const,
                raffleId: raffle.id
            }));

            await tx.ticket.createMany({
                data: ticketsData
            });

            return raffle;
        });

        return NextResponse.json({
            ok: true,
            raffleId: newRaffle.id,
            message: 'Nuevo sorteo iniciado correctamente'
        });

    } catch (error: any) {
        console.error('[Raffle Reset Error]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
