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
        const [ticketsSold, ticketsAvailable, ticketsReserved, uniqueBuyers, totalSoldAmount, analyticsRecord] = await Promise.all([
            // Tickets vendidos
            prisma.ticket.count({
                where: { status: "SOLD", raffleId }
            }),
            // Tickets disponibles
            prisma.ticket.count({
                where: { status: "AVAILABLE", raffleId }
            }),
            // Tickets reservados
            prisma.ticket.count({
                where: { status: "RESERVED", raffleId }
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

        const totalTickets = ticketsSold + ticketsAvailable + ticketsReserved;
        const visitsToday = analyticsRecord;
        const totalAmount = (totalSoldAmount._sum.amountCents ?? 0) / 100;

        return NextResponse.json({
            visitsToday,
            totalAmount,
            ticketsSold,
            ticketsAvailable,
            ticketsReserved,
            buyers: uniqueBuyers,
            totalTickets: totalTickets,
            raffleId
        });
    } catch (error) {
        console.error("[STATS_ERROR]", error);
        return NextResponse.json(
            { success: false, error: "Error al calcular estadísticas" },
            { status: 500 }
        );
    }
}
