
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTicketsEmail } from '@/lib/email';
import { recoverAndFixTicketNumbers } from '@/lib/ticketNumbersRecovery';

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
        if ((sale as any).lastEmailSentAt) {
            const now = new Date();
            const lastSent = new Date((sale as any).lastEmailSentAt);
            const secondsSince = (now.getTime() - lastSent.getTime()) / 1000;
            if (secondsSince < 60) {
                const wait = Math.ceil(60 - secondsSince);
                return NextResponse.json({
                    error: `Espera ${wait} segundos antes de solicitar otro envío.`
                }, { status: 429 });
            }
        }

        // ✅ LEY 0 - Recuperación y reparación antes de enviar
        const recovery = await prisma.$transaction(async (tx) => {
            return await recoverAndFixTicketNumbers(tx, sale.id);
        });

        if (!recovery.ok) {
            console.error(`[Resend API] Error recovering tickets for sale ${sale.id}: ${recovery.reason}`);
            return NextResponse.json({ error: `No se pudieron recuperar los tickets: ${recovery.reason}. Contacte a soporte.` }, { status: 404 });
        }

        const tickets = recovery.ticketNumbers;

        const emailResult = await sendTicketsEmail({
            to: sale.customer.email,
            customerName: `${sale.customer.firstName} ${sale.customer.lastName}`,
            idNumber: sale.customer.idNumber,
            saleCode: sale.clientTransactionId.slice(-6).toUpperCase(),
            saleId: sale.id,
            tickets: tickets,
            total: sale.amountCents / 100,
            date: sale.confirmedAt || sale.createdAt
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
