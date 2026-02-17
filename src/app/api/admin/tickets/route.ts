import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('status') || 'ALL'; // ALL, SOLD, AVAILABLE
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '200', 10), 500);
        const q = searchParams.get('q') || '';

        const skip = (page - 1) * pageSize;

        // Get Active Raffle
        const activeRaffle = await prisma.raffle.findFirst({
            where: { status: 'ACTIVE' }
        });

        if (!activeRaffle) {
            return NextResponse.json({ ok: false, error: 'No active raffle' }, { status: 404 });
        }

        // Build Filters
        const where: any = { raffleId: activeRaffle.id };
        if (mode === 'SOLD') where.status = 'SOLD';
        if (mode === 'AVAILABLE') where.status = 'AVAILABLE';

        if (q) {
            const num = parseInt(q, 10);
            if (!isNaN(num)) {
                where.number = num;
            }
        }

        // Fetch Data
        const [tickets, totalCount] = await Promise.all([
            prisma.ticket.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { number: 'asc' },
                include: {
                    sale: {
                        select: {
                            id: true,
                            customer: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    idNumber: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.ticket.count({ where })
        ]);

        // Helper counts for the whole raffle
        const [soldCount, availableCount] = await Promise.all([
            prisma.ticket.count({ where: { raffleId: activeRaffle.id, status: 'SOLD' } }),
            prisma.ticket.count({ where: { raffleId: activeRaffle.id, status: 'AVAILABLE' } })
        ]);

        return NextResponse.json({
            ok: true,
            tickets: tickets.map(t => ({
                id: t.id,
                number: t.number.toString().padStart(4, '0'),
                status: t.status,
                buyerName: t.sale?.customer ? `${t.sale.customer.firstName} ${t.sale.customer.lastName}` : null,
                cedula: t.sale?.customer?.idNumber || null,
                saleId: t.sale?.id || null
            })),
            pagination: {
                page,
                pageSize,
                totalItems: totalCount,
                totalPages: Math.ceil(totalCount / pageSize)
            },
            summary: {
                sold: soldCount,
                available: availableCount,
                total: soldCount + availableCount
            }
        });

    } catch (error: any) {
        console.error('[Tickets API Error]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
