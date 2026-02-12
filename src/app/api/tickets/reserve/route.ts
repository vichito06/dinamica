import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TicketStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tickets, sessionId } = body;

        if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
            return NextResponse.json({ error: 'No tickets provided', code: 'INVALID_INPUT' }, { status: 400 });
        }

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required', code: 'SESSION_REQUIRED' }, { status: 400 });
        }

        const ticketNumbers = tickets.map((n: any) => parseInt(n, 10));
        const now = new Date();

        // Transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // Check current status of requested tickets
            const existingTickets = await tx.ticket.findMany({
                where: { number: { in: ticketNumbers } }
            });

            const unavailable = existingTickets.filter(t => {
                // Not available if:
                // 1. Already SOLD
                // 2. Already HELD by ANOTHER session and hold hasn't expired
                const isSold = t.status === TicketStatus.SOLD;
                const isHeldByOthers = t.status === TicketStatus.HELD &&
                    t.sessionId !== sessionId &&
                    t.reservedUntil && t.reservedUntil > now;
                return isSold || isHeldByOthers;
            });

            if (unavailable.length > 0) {
                return {
                    success: false,
                    code: 'TICKET_ALREADY_RESERVED',
                    unavailable: unavailable.map(t => t.number)
                };
            }

            // Reserve/Update tickets
            const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now

            for (const num of ticketNumbers) {
                await tx.ticket.upsert({
                    where: { number: num },
                    update: {
                        status: TicketStatus.HELD,
                        sessionId: sessionId,
                        reservedUntil: expiresAt
                    },
                    create: {
                        number: num,
                        status: TicketStatus.HELD,
                        sessionId: sessionId,
                        reservedUntil: expiresAt
                    }
                });
            }

            return { success: true };
        });

        if (!result.success) {
            return NextResponse.json({
                error: 'Algunos números ya han sido reservados o comprados.',
                code: result.code,
                unavailable: result.unavailable
            }, { status: 409 });
        }

        return NextResponse.json({
            ok: true,
            success: true,
            message: 'Tickets reserved successfully'
        });

    } catch (error) {
        console.error('Reservation error:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            code: 'INTERNAL_ERROR'
        }, { status: 500 });
    }
}
