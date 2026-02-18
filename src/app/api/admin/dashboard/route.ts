import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { startOfDay, endOfDay, eachDayOfInterval, format, parseISO } from "date-fns";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const dateFrom = from ? startOfDay(parseISO(from)) : startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        const dateTo = to ? endOfDay(parseISO(to)) : endOfDay(new Date());

        // Get Active Raffle
        const activeRaffle = await prisma.raffle.findFirst({
            where: { status: 'ACTIVE' }
        });

        if (!activeRaffle) {
            return NextResponse.json({ ok: false, error: 'No active raffle' }, { status: 404 });
        }

        // Parallel fetching of metrics
        const [
            visits,
            sales,
            ticketsSold,
            ticketsAvailable,
            ticketsReserved,
            buyers
        ] = await Promise.all([
            // Visits (LANDING_VISIT)
            prisma.analyticsEvent.count({
                where: {
                    raffleId: activeRaffle.id,
                    type: 'LANDING_VISIT',
                    createdAt: { gte: dateFrom, lte: dateTo }
                }
            }),
            // Total Sold Amount
            prisma.sale.aggregate({
                where: {
                    raffleId: activeRaffle.id,
                    status: 'PAID',
                    confirmedAt: { gte: dateFrom, lte: dateTo }
                },
                _sum: { amountCents: true },
                _count: { id: true }
            }),
            // Tickets Sold
            prisma.ticket.count({
                where: {
                    raffleId: activeRaffle.id,
                    status: 'SOLD',
                    soldAt: { gte: dateFrom, lte: dateTo }
                }
            }),
            // Tickets Available
            prisma.ticket.count({
                where: {
                    raffleId: activeRaffle.id,
                    status: 'AVAILABLE'
                }
            }),
            // Tickets Reserved
            prisma.ticket.count({
                where: {
                    raffleId: activeRaffle.id,
                    status: 'RESERVED'
                }
            }),
            // Unique Buyers
            prisma.sale.groupBy({
                by: ['customerId'],
                where: {
                    raffleId: activeRaffle.id,
                    status: 'PAID',
                    confirmedAt: { gte: dateFrom, lte: dateTo }
                }
            })
        ]);

        const ticketsSoldCount = ticketsSold;
        const ticketsTotal = ticketsSold + ticketsAvailable + ticketsReserved;
        const totalSoldAmount = (sales._sum.amountCents || 0) / 100;

        // Daily Trends
        const days = eachDayOfInterval({ start: dateFrom, end: dateTo });

        // Fetch daily data for the interval
        const dailyData = await Promise.all(days.map(async (day) => {
            const start = startOfDay(day);
            const end = endOfDay(day);
            const dateStr = format(day, 'yyyy-MM-dd');

            const [v, s, t] = await Promise.all([
                prisma.analyticsEvent.count({
                    where: {
                        raffleId: activeRaffle.id,
                        type: 'LANDING_VISIT',
                        createdAt: { gte: start, lte: end }
                    }
                }),
                prisma.sale.aggregate({
                    where: {
                        raffleId: activeRaffle.id,
                        status: 'PAID',
                        confirmedAt: { gte: start, lte: end }
                    },
                    _sum: { amountCents: true },
                    _count: { id: true }
                }),
                prisma.ticket.count({
                    where: {
                        raffleId: activeRaffle.id,
                        status: 'SOLD',
                        soldAt: { gte: start, lte: end }
                    }
                })
            ]);

            return {
                date: dateStr,
                visits: v,
                salesCount: s._count.id,
                ticketsSold: t,
                amount: (s._sum.amountCents || 0) / 100
            };
        }));

        return NextResponse.json({
            ok: true,
            raffle: {
                id: activeRaffle.id,
                name: activeRaffle.name,
                status: activeRaffle.status
            },
            metrics: {
                visitsCount: visits,
                totalSoldAmount,
                totalSalesCount: sales._count.id,
                ticketsSoldCount,
                ticketsReservedCount: ticketsReserved,
                buyersCount: buyers.length,
                ticketsTotal,
                ticketsAvailableCount: ticketsAvailable
            },
            dailyTrends: dailyData
        });

    } catch (error: any) {
        console.error('[Dashboard API Error]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
