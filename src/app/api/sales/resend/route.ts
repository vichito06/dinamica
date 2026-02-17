
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTicketsEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const { saleId } = await request.json();

        if (!saleId) {
            return NextResponse.json({ error: 'Falta ID de venta' }, { status: 400 });
        }

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { customer: true }
        });

        if (!sale || sale.status !== 'PAID') {
            return NextResponse.json({ error: 'Venta no encontrada o no pagada' }, { status: 404 });
        }

        // Use snapshot numbers if available, fallback to relation
        let tickets = sale.ticketNumbers;
        if (tickets.length === 0) {
            const ticketRecords = await prisma.ticket.findMany({
                where: { saleId: sale.id },
                orderBy: { number: 'asc' }
            });
            tickets = ticketRecords.map(t => t.number.toString().padStart(4, '0'));
        }

        const emailResult = await sendTicketsEmail({
            to: sale.customer.email,
            customerName: `${sale.customer.firstName} ${sale.customer.lastName}`,
            saleCode: sale.clientTransactionId.slice(-6).toUpperCase(),
            tickets: tickets,
            total: sale.amountCents / 100
        });

        if (!emailResult.success) {
            return NextResponse.json({ error: 'No se pudo enviar el correo', detail: emailResult.error }, { status: 500 });
        }

        return NextResponse.json({ ok: true, message: 'Correo reenviado con éxito' });

    } catch (error: any) {
        console.error('[Resend API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
