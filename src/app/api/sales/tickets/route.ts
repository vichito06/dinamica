import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { recoverAndFixTicketNumbers } from "@/lib/ticketNumbersRecovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
    try {
        const { saleId } = await req.json().catch(() => ({}));

        if (!saleId) {
            return NextResponse.json({ ok: false, error: 'saleId required' }, { status: 400 });
        }

        // Use the definitive recover and fix core
        const rec = await prisma.$transaction(async (tx) => {
            return await recoverAndFixTicketNumbers(tx, saleId);
        });

        if (!rec.ok) {
            return NextResponse.json({
                ok: false,
                error: rec.reason,
                saleId,
                ticketNumbers: []
            }, { status: 500 });
        }

        console.log(`[sales/tickets] saleId=${saleId} source=${rec.source} tickets=${rec.ticketNumbers.length}`);

        return NextResponse.json({
            ok: true,
            saleId,
            ticketNumbers: rec.ticketNumbers,
            source: rec.source
        }, {
            headers: { 'Cache-Control': 'no-store' }
        });

    } catch (error: any) {
        console.error('[Sales Tickets API] Error:', error);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
