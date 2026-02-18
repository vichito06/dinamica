import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SaleStatus, TicketStatus } from '@prisma/client';
import { promoteTicketsForSale } from '@/lib/ticketPromotion';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // Auth check
        const VALID_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.TEST_SECRET;
        const cookieStore = await cookies();
        const session = cookieStore.get('admin_session')?.value ?? cookieStore.get('admin_auth')?.value;

        if (!session || session !== VALID_SECRET) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { saleId } = await request.json();
        if (!saleId) return NextResponse.json({ ok: false, error: 'saleId is required' }, { status: 400 });

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { tickets: true }
        });

        if (!sale) return NextResponse.json({ ok: false, error: 'Sale not found' }, { status: 404 });

        // Only repair PAID sales with 0 tickets SOLD
        const soldCount = sale.tickets.filter(t => t.status === TicketStatus.SOLD).length;

        if (sale.status !== SaleStatus.PAID) {
            return NextResponse.json({ ok: false, error: 'Solo se pueden reparar ventas en estado PAID.' }, { status: 400 });
        }

        if (soldCount > 0) {
            return NextResponse.json({ ok: true, message: 'La venta ya tiene tickets asignados.', tickets: soldCount });
        }

        console.log(`[REPAIR] Attempting to repair ghost sale ${saleId}...`);

        // Attempt reconstruction
        try {
            const ticketNumbers = await prisma.$transaction(async (tx) => {
                // promoteTicketsForSale handles requestedNumbers snapshot
                return await promoteTicketsForSale(tx, saleId);
            }, { timeout: 20000 });

            console.log(`[REPAIR] SUCCESS for sale ${saleId}. Tickets promoted: ${ticketNumbers.length}`);

            return NextResponse.json({
                ok: true,
                message: 'Venta reparada exitosamente.',
                tickets: ticketNumbers.length,
                numbers: ticketNumbers
            });

        } catch (repairErr: any) {
            console.error(`[REPAIR] FAILED for sale ${saleId}:`, repairErr.message);

            // Si falló promoteTicketsForSale, intentar un fallback manual si hay tickets RESERVED
            if (repairErr.message.includes('no requestedNumbersSnapshot')) {
                // Intentar rescatar tickets RESERVED vinculados
                const reservedTickets = await prisma.ticket.findMany({
                    where: { saleId: saleId, status: TicketStatus.RESERVED }
                });

                if (reservedTickets.length > 0) {
                    console.log(`[REPAIR] Fallback: Found ${reservedTickets.length} RESERVED tickets for sale ${saleId}. Promoting manually...`);
                    const numbers = reservedTickets.map(t => t.number);

                    await prisma.$transaction(async (tx) => {
                        await tx.ticket.updateMany({
                            where: { id: { in: reservedTickets.map(t => t.id) } },
                            data: { status: TicketStatus.SOLD, soldAt: new Date() }
                        });
                        await tx.sale.update({
                            where: { id: saleId },
                            data: {
                                ticketNumbers: numbers.map(n => n.toString().padStart(4, '0')),
                                lastError: null
                            } as any
                        });
                    });

                    return NextResponse.json({
                        ok: true,
                        message: 'Venta reparada vía tickets RESERVED vinculados.',
                        tickets: numbers.length
                    });
                }
            }

            return NextResponse.json({
                ok: false,
                error: `Error durante la reparación: ${repairErr.message}`
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[Repair API] Error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
