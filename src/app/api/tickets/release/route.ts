import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TicketStatus } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    let requestId = "req_release_" + Date.now();
    try {
        const body = await request.json();
        const { ticketNumber, ticketNumbers, sessionId } = body;

        if ((!ticketNumber && (!ticketNumbers || !Array.isArray(ticketNumbers))) || !sessionId) {
            return NextResponse.json({ ok: false, error: 'Número(s) de ticket y sessionId son requeridos' }, { status: 400 });
        }

        const numbersToReleaseRaw = ticketNumbers
            ? ticketNumbers.map((n: string | number) => parseInt(n.toString(), 10)).filter((n: number) => !isNaN(n))
            : [parseInt(ticketNumber.toString(), 10)];

        // 1. Deduplicate and filter range
        const numbersToRelease: number[] = (Array.from(new Set(numbersToReleaseRaw)) as any[])
            .map(n => parseInt(n.toString(), 10))
            .filter((n: number) => !isNaN(n) && n >= 1 && n <= 9999);

        if (numbersToRelease.length === 0) {
            return NextResponse.json({ ok: true, released: 0, skipped: 0, total: 0 }); // Idempotent
        }

        // 2. Release the tickets if they belong to this session or are HELD (HELD in prisma = RESERVED)
        // Note: Using TicketStatus.HELD which is the enum value for reserved tickets in this DB
        const result = await prisma.ticket.updateMany({
            where: {
                number: { in: numbersToRelease },
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

        const released = result.count;
        const total = numbersToRelease.length;
        const skipped = total - released;

        console.log(`[tickets/release] [${requestId}] Released ${released} of ${total} tickets (skipped ${skipped}) for session ${sessionId}`);

        return NextResponse.json({
            ok: true,
            released,
            skipped,
            total,
            requestId
        });

    } catch (error: any) {
        console.error(`[tickets/release] FATAL:`, error);
        return NextResponse.json({ ok: false, error: 'Error interno al liberar el ticket' }, { status: 500 });
    }
}
