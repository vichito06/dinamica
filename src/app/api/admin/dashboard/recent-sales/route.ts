import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus } from "@prisma/client";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const jar = await cookies();
        const session = jar.get('admin_session')?.value ?? jar.get('admin_auth')?.value;
        const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();

        if (!session || session !== secret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
