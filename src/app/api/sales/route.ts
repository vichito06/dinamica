import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, SaleStatus, TicketStatus } from '@prisma/client';
import { cookies } from 'next/headers';

// Explicitly set max duration for long-running transactions
export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    let requestId = "req_sales_" + Date.now();
    try {
        try {
            requestId = (globalThis as any).crypto?.randomUUID?.() || requestId;
        } catch (e) { }

        const body = await request.json();
        const { personalData, ticketNumbers: bodyTicketNumbers, tickets: bodyTickets, total, sessionId } = body;
        const tickets = bodyTicketNumbers || bodyTickets;

        // 1. Validation & sanitization
        if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
            return NextResponse.json({ ok: false, error: 'No tickets selected', code: 'INVALID_INPUT', requestId }, { status: 400 });
        }

        const ticketNumbers = tickets
            .map((t: any) => parseInt(t, 10))
            .filter(n => !isNaN(n));

        if (ticketNumbers.length === 0) {
            return NextResponse.json({ ok: false, error: 'Lista de tickets inválida.', code: 'INVALID_TICKETS', requestId }, { status: 400 });
        }

        // 2. Transaction: Verify Availability + Create Customer/Sale + Reserve
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Check availability
            const existingTickets = await tx.ticket.findMany({
                where: { number: { in: ticketNumbers } }
            });

            const now = new Date();
            const unavailable = existingTickets.filter(t =>
                t.status === TicketStatus.SOLD ||
                (t.status === TicketStatus.HELD &&
                    t.reservedUntil && t.reservedUntil > now &&
                    t.sessionId !== sessionId)
            );

            if (unavailable.length > 0) {
                const unavailableNumbers = unavailable.map(t => t.number).join(', ');
                throw new Error(`DISPONIBILIDAD:${unavailableNumbers}`);
            }

            // Handle Customer (Upsert by Cédula)
            if (!personalData || !personalData.idNumber) {
                throw new Error('DATOS_INCOMPLETOS:Falta Cédula');
            }

            const customer = await tx.customer.upsert({
                where: { idNumber: personalData.idNumber },
                update: {
                    firstName: personalData.firstName?.toUpperCase(),
                    lastName: personalData.lastName?.toUpperCase(),
                    email: personalData.email,
                    phone: personalData.phone,
                },
                create: {
                    idNumber: personalData.idNumber,
                    firstName: personalData.firstName?.toUpperCase(),
                    lastName: personalData.lastName?.toUpperCase(),
                    email: personalData.email,
                    phone: personalData.phone,
                },
            });

            // Create Sale linked to Customer
            const sale = await tx.sale.create({
                data: {
                    status: SaleStatus.PENDING,
                    amountCents: Math.round(Number(total) * 100),
                    currency: 'USD',
                    customerId: customer.id,
                    provider: 'PAYPHONE',
                }
            });

            // Hold Tickets (anti-duplicate) - Bulk optimization
            const existingNumbers = existingTickets.map((t: { number: number }) => t.number);
            const missingNumbers = ticketNumbers.filter((num: number) => !existingNumbers.includes(num));
            const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

            if (existingNumbers.length > 0) {
                await tx.ticket.updateMany({
                    where: { number: { in: existingNumbers } },
                    data: {
                        status: TicketStatus.HELD,
                        saleId: sale.id,
                        sessionId: sessionId,
                        reservedUntil: expiresAt,
                    }
                });
            }

            if (missingNumbers.length > 0) {
                await tx.ticket.createMany({
                    data: missingNumbers.map((num: number) => ({
                        number: num,
                        status: TicketStatus.HELD,
                        saleId: sale.id,
                        sessionId: sessionId,
                        reservedUntil: expiresAt,
                    }))
                });
            }

            return sale;
        }, {
            timeout: 30000 // 30 seconds for sales creation
        });

        console.log(`[Sales API] [${requestId}] Sale created: ${result.id}`);
        return NextResponse.json({ ok: true, sale: result, id: result.id, requestId });

    } catch (error: any) {
        const isAdmin =
            request.headers.get('cookie')?.includes('admin_auth=true') ||
            request.headers.get('x-test-secret') === process.env.TEST_SECRET;

        const sanitizedError = {
            message: error?.message || 'Unknown Error',
            code: error?.code,
            meta: error?.meta,
            stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
        };

        console.error(`[Sales API] [${requestId}] ERROR:`, sanitizedError);

        const debug = isAdmin ? sanitizedError : undefined;

        if (error.message.startsWith('DISPONIBILIDAD:')) {
            const nums = error.message.split(':')[1];
            return NextResponse.json({
                ok: false,
                error: `Los números ya no están disponibles: ${nums}`,
                code: 'UNAVAILABLE',
                requestId
            }, { status: 409 });
        }

        return NextResponse.json({
            ok: false,
            error: 'Error interno al crear el pedido. Intente con menos tickets.',
            code: error.code || 'SALE_CREATE_FAILED',
            requestId,
            debug
        }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        // SECURITY: Allow access if secret is provided OR if user has an admin session
        const secret = request.headers.get('x-test-secret');
        const VALID_SECRET = process.env.TEST_SECRET || process.env.PAYPHONE_DEBUG_SECRET;

        const cookieStore = await cookies();
        const isAdmin = cookieStore.get('admin_auth')?.value === 'true';

        if (!isAdmin && (!secret || secret !== VALID_SECRET)) {
            console.warn(`[Sales API] Unauthorized GET attempt from ${request.headers.get('x-forwarded-for') || 'unknown'}`);
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q');

        let whereClause: any = {};

        if (q) {
            const isNumeric = /^\d+$/.test(q);
            if (isNumeric) {
                // Search by ticket number or ID number (internal query allowed)
                whereClause = {
                    OR: [
                        { tickets: { some: { number: parseInt(q) } } },
                        { customer: { idNumber: { contains: q } } }
                    ]
                };
            } else {
                // Search by name or email (internal query allowed)
                whereClause = {
                    OR: [
                        { customer: { firstName: { contains: q, mode: 'insensitive' } } },
                        { customer: { lastName: { contains: q, mode: 'insensitive' } } },
                        { customer: { email: { contains: q, mode: 'insensitive' } } }
                    ]
                };
            }
        }

        const sales = await prisma.sale.findMany({
            where: whereClause,
            include: {
                tickets: true,
                customer: true // Include customer for authorized admin view
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        // Format for frontend - Return what the Admin Panel expects
        const formattedSales = sales.map(s => ({
            id: s.id,
            total: s.amountCents / 100,
            status: s.status,
            date: s.createdAt,
            customerId: s.customerId,
            customer: {
                id: s.customer.id,
                firstName: s.customer.firstName,
                lastName: s.customer.lastName,
                fullName: `${s.customer.lastName} ${s.customer.firstName}`.trim(),
                email: s.customer.email,
                phone: s.customer.phone,
                idNumber: s.customer.idNumber
            },
            tickets: s.tickets.map(t => t.number.toString().padStart(4, '0'))
        }));

        return NextResponse.json(formattedSales);

    } catch (error) {
        console.error('[Sales API] Error fetching sales:', error);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}


