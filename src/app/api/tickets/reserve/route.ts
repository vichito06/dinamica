import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { Prisma, TicketStatus } from '@prisma/client';
import { cookies } from 'next/headers';

// Explicitly set max duration for long-running transactions (Vercel Support)
export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    let requestId = "req_" + Date.now();
    try {
        // Safe requestId generation with globalThis fallback
        try {
            requestId = (globalThis as any).crypto?.randomUUID?.() || requestId;
        } catch (e) { }

        const jar = await cookies();
        const session = jar.get('admin_session')?.value ?? jar.get('admin_auth')?.value;
        const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();
        const isAdmin = session && session === secret;

        const body = await request.json();
        const { ticketNumbers: bodyTicketNumbers, tickets: bodyTickets, sessionId } = body;
        const tickets = bodyTicketNumbers || bodyTickets;

        // 1. Validation & Sanitization
        if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
            return NextResponse.json({ ok: false, error: 'No tickets provided', code: 'INVALID_INPUT', requestId }, { status: 400 });
        }

        if (!sessionId || typeof sessionId !== 'string') {
            return NextResponse.json({ ok: false, error: 'Session ID required', code: 'SESSION_REQUIRED', requestId }, { status: 400 });
        }

        // Clean and validate ticket numbers
        const cleanTickets = tickets
            .map((t: any) => String(t).trim().padStart(4, '0'))
            .filter(t => /^\d{4,6}$/.test(t)); // Only 4-6 digit numeric strings

        const ticketNumbers = Array.from(new Set(cleanTickets))
            .map(n => parseInt(n, 10))
            .filter(n => !isNaN(n));

        const batchSize = ticketNumbers.length;

        if (batchSize === 0) {
            return NextResponse.json({ ok: false, error: 'Lista de tickets vacía o inválida.', code: 'INVALID_TICKETS', requestId }, { status: 400 });
        }

        console.log(`[tickets/reserve] [${requestId}] Batch size: ${batchSize}. Start transaction.`);

        const now = new Date();

        // 2. Transaction with increased timeout (30s)
        const result = await prisma.$transaction(async (tx) => {
            const now = new Date();

            // Get Active Raffle
            const raffle = await tx.raffle.findFirst({ where: { status: 'ACTIVE' } });
            if (!raffle) {
                throw new Error('NO_ACTIVE_RAFFLE:No active raffle found');
            }

            // A. Release expired RESERVED tickets first to maximize inventory
            await tx.ticket.updateMany({
                where: {
                    status: TicketStatus.RESERVED,
                    reservedUntil: { lt: now },
                    raffleId: raffle.id
                },
                data: {
                    status: TicketStatus.AVAILABLE,
                    reservedUntil: null,
                    sessionId: null,
                    saleId: null
                }
            });

            // B. Check availability for requested tickets
            const existing = await tx.ticket.findMany({
                where: {
                    number: { in: ticketNumbers },
                    raffleId: raffle.id
                }
            });

            const conflicts = existing.filter(t => {
                const isSold = t.status === TicketStatus.SOLD || t.saleId !== null;
                // If it's reserved by another session (and not expired as we just cleaned them)
                const isReservedByOthers = t.status === TicketStatus.RESERVED &&
                    t.sessionId !== sessionId;
                // Any status other than AVAILABLE or RESERVED by ME is a conflict
                const isNotAvailableOrMine = t.status !== TicketStatus.AVAILABLE &&
                    !(t.status === TicketStatus.RESERVED && t.sessionId === sessionId);

                return isSold || isReservedByOthers || isNotAvailableOrMine;
            });

            const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 min
            const existingNumbers = existing.map(t => t.number);
            const missingNumbers = ticketNumbers.filter(num => !existingNumbers.includes(num));

            if (conflicts.length > 0) {
                // If conflicts exist, we still want to reserve what WE CAN
                // But we return the conflicts to the UI for replacement
                const conflictNumbers = conflicts.map(t => t.number.toString().padStart(4, '0'));
                const availableToReserve = ticketNumbers.filter(n => !conflictNumbers.includes(n.toString().padStart(4, '0')));

                // Reserve the available ones
                if (availableToReserve.length > 0) {
                    await tx.ticket.updateMany({
                        where: {
                            number: { in: availableToReserve },
                            status: TicketStatus.AVAILABLE,
                            raffleId: raffle.id
                        },
                        data: {
                            status: TicketStatus.RESERVED,
                            sessionId: sessionId,
                            reservedUntil: expiresAt
                        }
                    });
                }

                return {
                    success: false,
                    code: 'PARTIAL_SUCCESS_WITH_CONFLICTS',
                    reserved: availableToReserve.map(n => n.toString().padStart(4, '0')),
                    unavailable: conflictNumbers
                };
            }

            // C. Bulk Update for ones that are AVAILABLE or already held by ME
            if (existingNumbers.length > 0) {
                await tx.ticket.updateMany({
                    where: {
                        number: { in: existingNumbers },
                        raffleId: raffle.id,
                        OR: [
                            { status: TicketStatus.AVAILABLE },
                            { sessionId: sessionId }
                        ]
                    },
                    data: {
                        status: TicketStatus.RESERVED,
                        sessionId: sessionId,
                        reservedUntil: expiresAt
                    }
                });
            }

            // D. Bulk Create for missing ones (optional safeguard)
            if (missingNumbers.length > 0) {
                await tx.ticket.createMany({
                    data: missingNumbers.map(num => ({
                        number: num,
                        status: TicketStatus.RESERVED,
                        sessionId: sessionId,
                        reservedUntil: expiresAt,
                        raffleId: raffle.id
                    })),
                    skipDuplicates: true
                });
            }

            const allReserved = ticketNumbers.map(n => n.toString().padStart(4, '0'));

            return {
                success: true,
                reserved: allReserved,
                unavailable: []
            };
        }, {
            timeout: 30000
        });

        if (!result.success && result.code === 'PARTIAL_SUCCESS_WITH_CONFLICTS') {
            return NextResponse.json({
                ok: false,
                code: result.code,
                error: 'Algunos números ya no están disponibles.',
                reserved: result.reserved,
                unavailable: result.unavailable,
                requestId
            }, { status: 409 });
        }

        console.log(`[tickets/reserve] [${requestId}] Success for ${ticketNumbers.length} tickets.`);

        return NextResponse.json({
            ok: true,
            reserved: result.reserved,
            unavailable: [],
            requestId
        });

    } catch (error: any) {
        // Safe Error Sanitization (to avoid Circular JSON errors in NextResponse.json)
        const sanitizedError = {
            message: error?.message || 'Unknown Error',
            code: error?.code,
            meta: error?.meta, // Prisma often puts details here
            stack: error?.stack?.split('\n').slice(0, 3).join('\n'), // Partial stack
        };

        const isAdmin =
            request.headers.get('cookie')?.includes('admin_auth=true') ||
            request.headers.get('x-test-secret') === process.env.TEST_SECRET;

        console.error(`[tickets/reserve] [${requestId}] FATAL:`, sanitizedError);

        // Map Prisma Connection Timeout (P2024) specifically
        if (error?.code === 'P2024') {
            return NextResponse.json({
                ok: false,
                code: 'DB_TIMEOUT',
                message: "La base de datos está tardando demasiado. Por favor, intente de nuevo en unos segundos.",
                requestId,
                debug: isAdmin ? sanitizedError : undefined
            }, { status: 504 });
        }

        return NextResponse.json({
            ok: false,
            code: error?.code || 'RESERVE_FAILED',
            message: error?.message || 'Error de servidor durante la reserva.',
            requestId,
            debug: isAdmin ? sanitizedError : undefined
        }, { status: 500 });
    }
}
