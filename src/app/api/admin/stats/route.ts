import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TOTAL_TICKETS = 99999; // Según el plan y requerimiento anterior

export async function GET() {
    try {
        // Tickets vendidos
        const ticketsSold = await prisma.ticket.count({
            where: {
                status: "SOLD",
            },
        });

        // Compradores únicos con ventas pagadas
        const uniqueBuyers = await prisma.customer.count({
            where: {
                sales: {
                    some: {
                        status: "PAID"
                    }
                }
            },
        });

        // Total vendido (en dólares)
        const totalSoldAmount = await prisma.sale.aggregate({
            _sum: {
                amountCents: true,
            },
            where: {
                status: "PAID",
            },
        });

        // Visitas hoy
        const analyticsRecord = await prisma.analytics.findUnique({
            where: { id: 1 }
        });

        let visitsToday = 0;
        if (analyticsRecord && typeof analyticsRecord.data === 'object' && analyticsRecord.data !== null) {
            const data = analyticsRecord.data as any;
            visitsToday = data.today?.unique || 0;
        }

        const ticketsAvailable = TOTAL_TICKETS - ticketsSold;
        const totalAmount = (totalSoldAmount._sum.amountCents ?? 0) / 100;

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
