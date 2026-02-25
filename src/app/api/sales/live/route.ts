import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 60; // Cache for 60 seconds

export async function GET() {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const sales = await prisma.sale.findMany({
            where: {
                status: "PAID",
                createdAt: {
                    gte: sevenDaysAgo,
                },
            },
            take: 10,
            orderBy: {
                createdAt: "desc",
            },
            select: {
                customer: {
                    select: {
                        firstName: true,
                        city: true,
                    },
                },
                ticketNumbers: true,
            },
        });

        const formattedSales = sales.map((sale) => ({
            name: sale.customer.firstName,
            city: sale.customer.city || "Ecuador",
            count: sale.ticketNumbers.length,
        }));

        return NextResponse.json(formattedSales);
    } catch (error) {
        console.error("[LIVE_SALES_ERROR]", error);
        return NextResponse.json([], { status: 500 });
    }
}
