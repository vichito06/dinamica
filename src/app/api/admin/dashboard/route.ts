import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { eachDayOfInterval, format } from "date-fns";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function dayStartUTC(dateStr: string) {
    // dateStr: "2026-02-18"
    // Ecuador -05:00 => inicio local = 00:00 -05:00 => UTC = 05:00Z
    return new Date(`${dateStr}T05:00:00.000Z`);
}

function dayEndUTC(dateStr: string) {
    // fin local 23:59:59 -05:00 => UTC = 04:59:59 del día siguiente
    const [y, m, day] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, day));
    dt.setUTCDate(dt.getUTCDate() + 1);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    const nextDayStr = `${yy}-${mm}-${dd}`;
    return new Date(`${nextDayStr}T04:59:59.999Z`);
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        // Default to last 7 days if no dates provided
        const startDateStr = from || format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        const endDateStr = to || format(new Date(), 'yyyy-MM-dd');

        const dateFrom = dayStartUTC(startDateStr);
        const dateTo = dayEndUTC(endDateStr);

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
                    event: 'LANDING_VISIT',
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
        const days = eachDayOfInterval({
            start: new Date(startDateStr + 'T00:00:00Z'),
            end: new Date(endDateStr + 'T00:00:00Z')
        });

        // Fetch daily data for the interval
        const dailyData = await Promise.all(days.map(async (day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const start = dayStartUTC(dateStr);
            const end = dayEndUTC(dateStr);

            const [v, s, t] = await Promise.all([
                prisma.analyticsEvent.count({
                    where: {
                        raffleId: activeRaffle.id,
                        event: 'LANDING_VISIT',
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
