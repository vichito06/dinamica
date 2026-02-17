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

        // 2. Release the tickets ONLY if they are RESERVED by THIS session.
        // This prevents one user from accidentally releasing another user's tickets if IDs collide or logic fails.
        const result = await prisma.ticket.updateMany({
            where: {
                number: { in: numbersToRelease },
                status: TicketStatus.RESERVED,
                sessionId: sessionId
            },
            data: {
                status: TicketStatus.AVAILABLE,
                sessionId: null,
                reservedUntil: null,
                saleId: null
            }
        });

        const releasedCount = result.count;
        const totalRequested = numbersToRelease.length;
        const skippedCount = totalRequested - releasedCount;

        console.log(`[tickets/release] [${requestId}] Released ${releasedCount} of ${totalRequested} tickets for session ${sessionId}`);

        return NextResponse.json({
            ok: true,
            released: releasedCount,
            skipped: skippedCount,
            requestId
        });

    } catch (error: any) {
        console.error(`[tickets/release] [req_release_${Date.now()}] FATAL:`, error);
        return NextResponse.json({
            ok: false,
            error: 'Error interno al liberar el ticket',
            message: error.message
        }, { status: 500 });
    }
}
