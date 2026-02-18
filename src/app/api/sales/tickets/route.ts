import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { promoteTicketsForSale } from "@/lib/ticketPromotion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
    try {
        const { saleId } = await req.json().catch(() => ({}));

        if (!saleId) {
            return NextResponse.json({ ok: false, error: 'saleId required' }, { status: 400 });
        }

        // Use the definitive promotion logic
        const ticketNumbers = await prisma.$transaction(async (tx) => {
            return await promoteTicketsForSale(tx, saleId);
        });

        console.log(`[sales/tickets] saleId=${saleId} tickets=${ticketNumbers.length}`);

        return NextResponse.json({
            ok: true,
            saleId,
            ticketNumbers: ticketNumbers,
            source: "standard_promote"
        }, {
            headers: { 'Cache-Control': 'no-store' }
        });

    } catch (error: any) {
        console.error('[Sales Tickets API] Error:', error);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
