import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma, SaleStatus, TicketStatus } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { personalData, tickets, total, sessionId } = body;

        // 1. Validation
        if (!tickets || tickets.length === 0) {
            return NextResponse.json({ error: 'No tickets selected' }, { status: 400 });
        }

        const ticketNumbers = tickets.map((t: any) => Number(t));

        // 2. Transaction: Verify Availability + Create Customer/Sale + Reserve
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Check availability
            const existingTickets = await tx.ticket.findMany({
                where: {
                    number: { in: ticketNumbers },
                }
            });

            const now = new Date();
            const unavailable = existingTickets.filter(t =>
                t.status === TicketStatus.SOLD ||
                (t.status === TicketStatus.HELD &&
                    t.reservedUntil && t.reservedUntil > now &&
                    t.sessionId !== sessionId) // Allow if held by the same session
            );

            if (unavailable.length > 0) {
                const unavailableNumbers = unavailable.map(t => t.number).join(', ');
                throw new Error(`Los siguientes números ya no están disponibles: ${unavailableNumbers}`);
            }

            // Handle Customer (Upsert by Cédula)
            if (!personalData || !personalData.idNumber) {
                throw new Error('Datos del cliente incompletos (Falta Cédula)');
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

            // Hold Tickets (anti-duplicate)
            for (const num of ticketNumbers) {
                await tx.ticket.upsert({
                    where: { number: num },
                    update: {
                        status: TicketStatus.HELD,
                        saleId: sale.id,
                        sessionId: sessionId,
                        reservedUntil: new Date(now.getTime() + 10 * 60 * 1000), // 10 minutes hold
                    },
                    create: {
                        number: num,
                        status: TicketStatus.HELD,
                        saleId: sale.id,
                        sessionId: sessionId,
                        reservedUntil: new Date(now.getTime() + 10 * 60 * 1000),
                    }
                });
            }

            return sale;
        });

        console.log(`[Sales API] Sale created: ${result.id}`);
        return NextResponse.json({ ok: true, sale: result, id: result.id });

    } catch (error: any) {
        console.error('Sale creation error:', error);
        const status = error.message.includes('disponibles') ? 409 : 500;
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
    }
}

export async function GET(request: Request) {
    try {
        // SECURITY: Require secret to list sales (Strict check)
        const secret = request.headers.get('x-test-secret');
        const VALID_SECRET = process.env.TEST_SECRET || process.env.PAYPHONE_DEBUG_SECRET;

        if (!secret || secret !== VALID_SECRET) {
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
                tickets: true
                // STRICT: DO NOT INCLUDE CUSTOMER HERE TO AVOID LEAKS
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        // Format for frontend - MINIMAL FIELDS ONLY (NO PII)
        const formattedSales = sales.map(s => ({
            id: s.id,
            total: s.amountCents / 100,
            status: s.status,
            date: s.createdAt,
            tickets: s.tickets.map(t => t.number.toString().padStart(4, '0'))
        }));

        return NextResponse.json(formattedSales);

    } catch (error) {
        console.error('[Sales API] Error fetching sales:', error);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}


