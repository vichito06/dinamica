import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // 1) Obtener el sorteo activo
        const raffle = await prisma.raffle.findFirst({
            where: { status: "ACTIVE" },
            select: { id: true },
        });

        if (!raffle) {
            return NextResponse.json(
                { total: 0, sold: 0, percent: 0 },
                {
                    headers: {
                        "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
                        "Access-Control-Allow-Origin": "*"
                    }
                }
            );
        }

        // 2) Contar total y vendidos
        const [total, sold] = await Promise.all([
            prisma.ticket.count({ where: { raffleId: raffle.id } }),
            prisma.ticket.count({ where: { raffleId: raffle.id, status: "SOLD" } }),
        ]);

        const porcentaje = total > 0 ? Number(((sold / total) * 100).toFixed(1)) : 0;

        return NextResponse.json(
            { total, vendido: sold, porcentaje },
            {
                headers: {
                    "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
                    "Access-Control-Allow-Origin": "*"
                },
            }
        );
    } catch (err) {
        console.error("[PUBLIC_PROGRESS_API] Error:", err);
        // Si falla, NO rompe el sistema: solo devuelve 0
        return NextResponse.json(
            { total: 0, vendido: 0, porcentaje: 0 },
            { headers: { "Cache-Control": "no-store" } }
        );
    }
}
