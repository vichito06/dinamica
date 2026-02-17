import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '10', 10);

        // Get Active Raffle
        const activeRaffle = await prisma.raffle.findFirst({ where: { status: 'ACTIVE' } });
        if (!activeRaffle) return NextResponse.json({ ok: true, sales: [] });

        const sales = await prisma.sale.findMany({
            where: {
                raffleId: activeRaffle.id,
                status: SaleStatus.PAID
            },
            take: limit,
            orderBy: { confirmedAt: 'desc' },
            include: {
                customer: {
                    select: {
                        firstName: true,
                        lastName: true,
                        idNumber: true,
                        phone: true
                    }
                }
            }
        });

        return NextResponse.json({
            ok: true,
            sales: sales.map(s => ({
                id: s.id,
                createdAt: s.createdAt,
                confirmedAt: s.confirmedAt,
                customer: s.customer,
                amount: s.amountCents / 100,
                ticketNumbers: s.ticketNumbers,
                clientTransactionId: s.clientTransactionId
            }))
        });

    } catch (error: any) {
        console.error('[Recent Sales API Error]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
