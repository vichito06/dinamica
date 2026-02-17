import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus, TicketStatus } from "@prisma/client";
import { getActiveRaffleId } from "@/lib/raffle";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { saleId } = await req.json();

        if (!saleId) return NextResponse.json({ error: "saleId required" }, { status: 400 });

        const raffleId = await getActiveRaffleId();

        await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findUnique({
                where: { id: saleId, raffleId: raffleId }
            });

            if (!sale) return; // Silent fail if not found in active raffle
            if (sale.status !== SaleStatus.PENDING) return; // Only cancel pending

            await tx.sale.update({
                where: { id: saleId },
                data: { status: SaleStatus.CANCELED }
            });

            await tx.ticket.updateMany({
                where: {
                    saleId: saleId,
                    status: TicketStatus.RESERVED,
                    raffleId: raffleId
                },
                data: { status: TicketStatus.AVAILABLE, reservedUntil: null, saleId: null }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API Cancel] Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
