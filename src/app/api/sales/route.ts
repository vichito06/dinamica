import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { personalData, tickets, total, sessionId } = body;

        // 1. Validation
        if (!tickets || tickets.length === 0) {
            return NextResponse.json({ error: 'No tickets selected' }, { status: 400 });
        }

        const ticketNumbers = tickets.map((t: any) => Number(t));

        // 2. Transaction: Verify Availability + Create Sale + Reserve
        const result = await prisma.$transaction(async (tx) => {
            // Check availability
            const existingTickets = await tx.ticket.findMany({
                where: {
                    number: { in: ticketNumbers },
                }
            });

            // If we don't have all tickets in DB, we might need to create them (if your logic allows implicit creation)
            // Or assume they exist. The schema has "number" unique.
            // If they don't exist, we can create them as AVAILABLE or RESERVED.
            // Let's assume we find collisions.

            const now = new Date();
            const unavailable = existingTickets.filter(t =>
                t.status === 'SOLD' ||
                (t.status === 'RESERVED' && t.reservedUntil && t.reservedUntil > now)
            );

            if (unavailable.length > 0) {
                const unavailableNumbers = unavailable.map(t => t.number).join(', ');
                throw new Error(`Los siguientes números ya no están disponibles: ${unavailableNumbers}`);
            }

            // Create Sale
            const sale = await tx.sale.create({
                data: {
                    status: 'PENDING',
                    amountCents: Math.round(Number(total) * 100), // Assuming total is $1 -> 100 cents
                    currency: 'USD',
                    personalData: personalData, // Storing JSON
                    // We don't link tickets here yet, we do it via update or connect on Ticket side or implicit
                }
            });

            // Reserve Tickets
            // We need to upsert tickets or update existing ones.
            // Since we need to handle "gap" tickets (tickets not yet in DB), upsert is best.
            // But updateMany doesn't create.
            // We iterate or use createMany with skipDuplicates? No, we need to update status.

            for (const num of ticketNumbers) {
                await tx.ticket.upsert({
                    where: { number: num },
                    update: {
                        status: 'RESERVED',
                        reservedBySaleId: sale.id,
                        reservedUntil: new Date(now.getTime() + 10 * 60 * 1000), // 10 minutes
                    },
                    create: {
                        number: num,
                        status: 'RESERVED',
                        reservedBySaleId: sale.id,
                        reservedUntil: new Date(now.getTime() + 10 * 60 * 1000),
                    }
                });
            }

            return sale;
        });

        return NextResponse.json({ success: true, id: result.id, sale: result });

    } catch (error: any) {
        console.error('Sale creation error:', error);
        const status = error.message.includes('disponibles') ? 409 : 500;
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
    }
}
