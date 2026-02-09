export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { saleId } = await req.json();

        if (!saleId) return NextResponse.json({ error: "saleId required" }, { status: 400 });

        await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findUnique({ where: { id: saleId } });

            if (!sale) return; // Silent fail if not found
            if (sale.status !== "PENDING") return; // Only cancel pending

            await tx.sale.update({
                where: { id: saleId },
                data: { status: "CANCELED" }
            });

            await tx.ticket.updateMany({
                where: { reservedBySaleId: saleId, status: "RESERVED" },
                data: { status: "AVAILABLE", reservedUntil: null, reservedBySaleId: null }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[API Cancel] Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
