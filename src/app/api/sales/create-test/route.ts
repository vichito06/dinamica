
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SaleStatus, TicketStatus } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * Endpoint de prueba para crear una venta mínima válida.
 * PROTEGIDO por header x-test-secret (env TEST_SECRET).
 */
export async function POST(request: Request) {
    try {
        const expectedSecret = process.env.TEST_SECRET;
        const providedSecret = request.headers.get('x-test-secret');

        if (!expectedSecret) {
            console.error('[Create Test Sale] TEST_SECRET not configured');
            return NextResponse.json({ ok: false, error: 'TEST_SECRET not configured' }, { status: 500 });
        }

        if (providedSecret !== expectedSecret) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Crear o usar cliente de prueba
        const testCustomer = await prisma.customer.upsert({
            where: { idNumber: '9999999999' },
            update: {},
            create: {
                idNumber: '9999999999',
                firstName: 'TEST',
                lastName: 'USER',
                email: 'test@example.com',
                phone: '0999999999'
            }
        });

        // Buscar un ticket disponible
        let ticket = await prisma.ticket.findFirst({
            where: { status: TicketStatus.AVAILABLE },
            orderBy: { number: 'desc' }
        });

        if (!ticket) {
            ticket = await prisma.ticket.upsert({
                where: { number: 99999 },
                update: { status: TicketStatus.AVAILABLE },
                create: {
                    number: 99999,
                    status: TicketStatus.AVAILABLE
                }
            });
        }

        // Crear la venta (limitado a 1 por request)
        const sale = await prisma.$transaction(async (tx) => {
            const newSale = await tx.sale.create({
                data: {
                    status: SaleStatus.PENDING,
                    amountCents: 100, // $1.00
                    currency: 'USD',
                    customerId: testCustomer.id,
                    provider: 'PAYPHONE'
                }
            });

            await tx.ticket.update({
                where: { id: ticket!.id },
                data: {
                    status: TicketStatus.HELD,
                    saleId: newSale.id,
                    reservedUntil: new Date(Date.now() + 15 * 60 * 1000)
                }
            });

            return newSale;
        });

        console.log(`[Create Test Sale] Created saleId: ${sale.id}`);
        return NextResponse.json({
            ok: true,
            saleId: sale.id
        });

    } catch (error: any) {
        console.error('[Create Test Sale Error]:', error);
        return NextResponse.json({
            ok: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}

