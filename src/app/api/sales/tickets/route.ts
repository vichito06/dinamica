import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { recoverTicketNumbers } from "@/lib/ticketNumbersRecovery";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { saleId } = await req.json();

        if (!saleId) {
            return NextResponse.json({ error: 'Missing saleId' }, { status: 400 });
        }

        // Use the unified core recovery logic
        const recovery = await recoverTicketNumbers(prisma, saleId);

        console.log(`[sales/tickets] saleId=${saleId} source=${recovery.source} snapshot=${recovery.counts.snapshot} sold=${recovery.counts.sold} reserved=${recovery.counts.reserved}`);

        if (recovery.numbers.length === 0) {
            return NextResponse.json({
                ok: true,
                saleId,
                ticketNumbers: [],
                reason: "No paid/reserved tickets found for this sale."
            }, { headers: { 'Cache-Control': 'no-store' } });
        }

        return NextResponse.json({
            ok: true,
            saleId,
            ticketNumbers: recovery.numbers,
            source: recovery.source
        }, {
            headers: { 'Cache-Control': 'no-store' }
        });

    } catch (error: any) {
        console.error('[Sales Tickets API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
