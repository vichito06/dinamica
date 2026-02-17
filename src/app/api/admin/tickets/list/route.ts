import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('mode') || 'all'; // all, sold, available
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('pageSize') || '200', 10);
        const search = searchParams.get('search') || '';

        const skip = (page - 1) * pageSize;

        // Get Active Raffle
        const activeRaffle = await prisma.raffle.findFirst({ where: { status: 'ACTIVE' } });
        if (!activeRaffle) return NextResponse.json({ ok: false, error: 'No active raffle' }, { status: 404 });

        // Build Filters
        const where: any = { raffleId: activeRaffle.id };
        if (mode === 'sold') where.status = 'SOLD';
        if (mode === 'available') where.status = 'AVAILABLE';

        if (search) {
            const num = parseInt(search, 10);
            if (!isNaN(num)) {
                where.number = num;
            }
        }

        // Fetch Data
        const [tickets, totalCount, soldCount, availableCount] = await Promise.all([
            prisma.ticket.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { number: 'asc' },
                include: {
                    sale: {
                        select: {
                            id: true,
                            confirmedAt: true,
                            customer: {
                                select: { firstName: true, lastName: true, idNumber: true }
                            }
                        }
                    }
                }
            }),
            prisma.ticket.count({ where: { raffleId: activeRaffle.id } }),
            prisma.ticket.count({ where: { raffleId: activeRaffle.id, status: 'SOLD' } }),
            prisma.ticket.count({ where: { raffleId: activeRaffle.id, status: 'AVAILABLE' } })
        ]);

        return NextResponse.json({
            ok: true,
            tickets: tickets.map(t => ({
                id: t.id,
                number: t.number.toString().padStart(4, '0'),
                status: t.status,
                saleId: t.sale?.id,
                soldAt: t.sale?.confirmedAt,
                customer: t.sale?.customer
            })),
            pagination: {
                page,
                pageSize,
                totalItems: mode === 'all' ? totalCount : (mode === 'sold' ? soldCount : availableCount),
                totalPages: Math.ceil((mode === 'all' ? totalCount : (mode === 'sold' ? soldCount : availableCount)) / pageSize)
            },
            counts: {
                total: totalCount,
                sold: soldCount,
                available: availableCount
            }
        });

    } catch (error: any) {
        console.error('[Ticket List API Error]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
