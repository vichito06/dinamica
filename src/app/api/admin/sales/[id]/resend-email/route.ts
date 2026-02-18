import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTicketsEmail } from '@/lib/email';
import { recoverAndFixTicketNumbers } from '@/lib/ticketNumbersRecovery';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: saleId } = await context.params;

        // Admin Auth Check
        const VALID_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.TEST_SECRET;
        const cookieStore = await cookies();
        const session = cookieStore.get('admin_session')?.value ?? cookieStore.get('admin_auth')?.value;

        if (!session || session !== VALID_SECRET) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        if (!saleId) {
            return NextResponse.json({ error: 'Falta ID de venta' }, { status: 400 });
        }

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { customer: true }
        });

        if (!sale || sale.status !== 'PAID') {
            return NextResponse.json({ error: 'La venta no existe o no está en estado PAID.' }, { status: 404 });
        }

        // Recuperación y reparación previa (Ley 0)
        const recovery = await prisma.$transaction(async (tx) => {
            return await recoverAndFixTicketNumbers(tx, sale.id);
        });

        if (!recovery.ok) {
            return NextResponse.json({ error: `No se pudieron recuperar los tickets: ${recovery.reason}` }, { status: 404 });
        }

        const tickets = recovery.ticketNumbers;

        console.log(`[ADMIN RESEND] Sending email for sale ${sale.id} to ${sale.customer.email}`);

        const emailResult = await sendTicketsEmail({
            to: sale.customer.email,
            customerName: `${sale.customer.firstName} ${sale.customer.lastName}`,
            saleCode: sale.clientTransactionId.slice(-6).toUpperCase(),
            tickets: tickets,
            total: sale.amountCents / 100
        });

        if (!emailResult.success) {
            return NextResponse.json({
                error: 'Error al enviar el correo.',
                detail: emailResult.error
            }, { status: 500 });
        }

        // Marcar envío exitoso
        await prisma.sale.update({
            where: { id: sale.id },
            data: {
                lastEmailSentAt: new Date(),
                lastError: null
            } as any
        });

        return NextResponse.json({ ok: true, message: '¡Correo reenviado con éxito desde el panel administrativo!' });

    } catch (error: any) {
        console.error('[Admin Resend API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
