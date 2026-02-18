import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus } from "@prisma/client";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        // Set date range (normalized to day start/end)
        const dateFrom = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        dateFrom.setHours(0, 0, 0, 0);

        const dateTo = to ? new Date(to) : new Date();
        dateTo.setHours(23, 59, 59, 999);

        // 1. Get Active Raffle
        let activeRaffle = await prisma.raffle.findFirst({ where: { status: 'ACTIVE' } });
        if (!activeRaffle) {
            activeRaffle = await prisma.raffle.create({
                data: { name: 'Dinamica Principal', status: 'ACTIVE' }
            });
        }

        // 2. Aggregate Sales Data in Range
        const salesInRange = await prisma.sale.aggregate({
            _sum: { amountCents: true },
            _count: { id: true },
            where: {
                raffleId: activeRaffle.id,
                status: SaleStatus.PAID,
                confirmedAt: { gte: dateFrom, lte: dateTo }
            }
        });

        // 3. Tickets Sold (Current Raffle Total)
        const [ticketsSoldTotal, ticketsAvailableTotal, ticketsReservedTotal] = await Promise.all([
            prisma.ticket.count({
                where: { raffleId: activeRaffle.id, status: 'SOLD' }
            }),
            prisma.ticket.count({
                where: { raffleId: activeRaffle.id, status: 'AVAILABLE' }
            }),
            prisma.ticket.count({
                where: { raffleId: activeRaffle.id, status: 'RESERVED' }
            })
        ]);

        // 4. Unique Buyers (by customer.idNumber)
        const uniqueBuyersInRange = await prisma.customer.count({
            where: {
                sales: {
                    some: {
                        raffleId: activeRaffle.id,
                        status: SaleStatus.PAID,
                        confirmedAt: { gte: dateFrom, lte: dateTo }
                    }
                }
            }
        });

        // ... existing visits logic ...
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const visitsToday = await prisma.analyticsEvent.count({
            where: {
                raffleId: activeRaffle.id,
                type: 'pageview',
                createdAt: { gte: todayStart }
            }
        });

        // 6. Last 7 Days Series
        // ... (skipping loop for brevity in replacement, but I must keep it)
        const series = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const start = new Date(d); start.setHours(0, 0, 0, 0);
            const end = new Date(d); end.setHours(23, 59, 59, 999);

            const daySales = await prisma.sale.aggregate({
                _sum: { amountCents: true },
                _count: { id: true },
                where: {
                    raffleId: activeRaffle.id,
                    status: SaleStatus.PAID,
                    confirmedAt: { gte: start, lte: end }
                }
            });

            const dayVisits = await prisma.analyticsEvent.count({
                where: {
                    raffleId: activeRaffle.id,
                    type: 'pageview',
                    createdAt: { gte: start, lte: end }
                }
            });

            // Count tickets sold in THIS day
            const dayTickets = await prisma.ticket.count({
                where: {
                    raffleId: activeRaffle.id,
                    status: 'SOLD',
                    sale: { confirmedAt: { gte: start, lte: end } }
                }
            });

            series.push({
                date: start.toISOString().split('T')[0],
                visits: dayVisits,
                soldAmount: (daySales._sum.amountCents || 0) / 100,
                ticketsSold: dayTickets,
                salesCount: daySales._count.id
            });
        }

        return NextResponse.json({
            ok: true,
            raffle: { id: activeRaffle.id, name: activeRaffle.name },
            metrics: {
                visitsToday,
                salesTotal: (salesInRange._sum.amountCents || 0) / 100,
                salesCount: salesInRange._count.id,
                ticketsSold: ticketsSoldTotal,
                ticketsAvailable: ticketsAvailableTotal,
                ticketsReserved: ticketsReservedTotal,
                totalTickets: ticketsSoldTotal + ticketsAvailableTotal + ticketsReservedTotal,
                buyersUnique: uniqueBuyersInRange
            },
            series
        });

    } catch (error: any) {
        console.error('[Summary API Error]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
