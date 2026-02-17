
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

        // Read additional info directly from Sale table
        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { customer: true }
        });

        if (!sale || sale.status !== 'PAID') {
            return NextResponse.json({ error: 'La venta no se encuentra o no ha sido pagada.' }, { status: 404 });
        }

        // Implementation of a short cool-down to prevent spam (60 seconds)
        if (sale.lastEmailSentAt) {
            const now = new Date();
            const lastSent = new Date(sale.lastEmailSentAt);
            const secondsSince = (now.getTime() - lastSent.getTime()) / 1000;
            if (secondsSince < 60) {
                const wait = Math.ceil(60 - secondsSince);
                return NextResponse.json({
                    error: `Espera ${wait} segundos antes de solicitar otro envío.`
                }, { status: 429 });
            }
        }

        // Use snapshot numbers as primary source
        let tickets = sale.ticketNumbers;
        if (!tickets || tickets.length === 0) {
            // Fallback just in case snapshot failed during confirm
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
            const isRateLimit = (emailResult as any).isRateLimit;
            return NextResponse.json({
                error: isRateLimit ? 'Límite de envíos alcanzado por ahora. Intenta en unos minutos.' : 'No se pudo enviar el correo.',
                detail: emailResult.error
            }, { status: isRateLimit ? 429 : 500 });
        }

        return NextResponse.json({ ok: true, message: '¡Correo reenviado con éxito!' });

    } catch (error: any) {
        console.error('[Resend API] Error:', error);
        return NextResponse.json({ error: 'Error interno al procesar el reenvío.' }, { status: 500 });
    }
}
