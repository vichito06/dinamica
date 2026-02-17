import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { saleId } = await req.json();

        if (!saleId) {
            return NextResponse.json({ error: 'Missing saleId' }, { status: 400 });
        }

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { tickets: { orderBy: { number: 'asc' } } }
        });

        if (!sale) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        const pad4 = (num: number | string) => String(num).padStart(4, '0');

        // Logic sync with /confirm: Snapshot -> SOLD Tickets
        let tickets: string[] = (sale as any).ticketNumbers || [];

        if (tickets.length === 0) {
            const soldTickets = await prisma.ticket.findMany({
                where: { saleId: sale.id, status: TicketStatus.SOLD },
                orderBy: { number: 'asc' }
            });
            tickets = soldTickets.map(t => pad4(t.number));
        } else {
            // Ensure format and order even for snapshots
            tickets = tickets.map(n => pad4(n)).sort();
        }

        return NextResponse.json({
            ok: true,
            saleId: sale.id,
            ticketNumbers: tickets
        }, {
            headers: { 'Cache-Control': 'no-store' }
        });

    } catch (error: any) {
        console.error('[Sales Tickets API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
