import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        // Get Active Raffle
        const activeRaffle = await prisma.raffle.findFirst({ where: { active: true } });
        if (!activeRaffle) return NextResponse.json({ ok: true, tickets: [] });

        const tickets = await prisma.ticket.findMany({
            where: {
                raffleId: activeRaffle.id,
                status: 'SOLD',
                sale: { status: SaleStatus.PAID }
            },
            take: limit,
            orderBy: { sale: { confirmedAt: 'desc' } },
            include: {
                sale: {
                    select: {
                        confirmedAt: true,
                        id: true,
                        customer: {
                            select: { firstName: true, lastName: true }
                        }
                    }
                }
            }
        });

        return NextResponse.json({
            ok: true,
            tickets: tickets.map(t => ({
                number: t.number,
                soldAt: t.sale?.confirmedAt,
                saleId: t.sale?.id,
                customer: t.sale?.customer
            }))
        });

    } catch (error: any) {
        console.error('[Recent Tickets API Error]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
