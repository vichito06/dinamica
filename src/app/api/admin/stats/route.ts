import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getActiveRaffle } from "@/lib/raffle";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    try {
        // 1. Get Active Raffle
        const activeRaffle = await getActiveRaffle();
        const raffleId = activeRaffle.id;

        // 2. Metrics parallel fetch
        const [ticketsSold, uniqueBuyers, totalSoldAmount, analyticsRecord] = await Promise.all([
            // Tickets vendidos
            prisma.ticket.count({
                where: { status: "SOLD", raffleId }
            }),
            // Compradores únicos con ventas pagadas
            prisma.customer.count({
                where: {
                    sales: { some: { status: "PAID", raffleId } }
                }
            }),
            // Total vendido (en dólares)
            prisma.sale.aggregate({
                _sum: { amountCents: true },
                where: { status: "PAID", raffleId }
            }),
            // Visitas hoy (AnalyticsEvent scoped)
            prisma.analyticsEvent.count({
                where: {
                    type: 'pageview',
                    raffleId,
                    createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            })
        ]);

        const TOTAL_TICKETS = 9999;
        const visitsToday = analyticsRecord;
        const ticketsAvailable = TOTAL_TICKETS - ticketsSold;
        const totalAmount = (totalSoldAmount._sum.amountCents ?? 0) / 100;

        return NextResponse.json({
            visitsToday,
            totalAmount,
            ticketsSold,
            buyers: uniqueBuyers,
            totalTickets: TOTAL_TICKETS,
            ticketsAvailable,
            raffleId
        });

        return NextResponse.json({
            visitsToday,
            totalAmount,
            ticketsSold,
            buyers: uniqueBuyers,
            totalTickets: TOTAL_TICKETS,
            ticketsAvailable,
        });

    } catch (error) {
        console.error("[STATS_ERROR]", error);
        return NextResponse.json(
            { success: false, error: "Error al calcular estadísticas" },
            { status: 500 }
        );
    }
}
