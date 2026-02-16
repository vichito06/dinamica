import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TicketStatus } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    let requestId = "req_release_" + Date.now();
    try {
        const body = await request.json();
        const { ticketNumber, sessionId } = body;

        if (!ticketNumber || !sessionId) {
            return NextResponse.json({ ok: false, error: 'Número de ticket y sessionId son requeridos' }, { status: 400 });
        }

        const num = parseInt(ticketNumber, 10);
        if (isNaN(num)) {
            return NextResponse.json({ ok: false, error: 'Número de ticket inválido' }, { status: 400 });
        }

        // Release the ticket if it belongs to this session or is HELD
        const result = await prisma.ticket.updateMany({
            where: {
                number: num,
                status: TicketStatus.HELD,
                sessionId: sessionId
            },
            data: {
                status: TicketStatus.AVAILABLE,
                sessionId: null,
                reservedUntil: null,
                saleId: null
            }
        });

        if (result.count === 0) {
            console.log(`[tickets/release] No ticket found to release for number ${num} and session ${sessionId}`);
        }

        return NextResponse.json({ ok: true });

    } catch (error: any) {
        console.error(`[tickets/release] FATAL:`, error);
        return NextResponse.json({ ok: false, error: 'Error interno al liberar el ticket' }, { status: 500 });
    }
}
