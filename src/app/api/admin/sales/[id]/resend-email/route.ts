import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSaleEmail } from '@/lib/email';
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

        try {
            const result = await sendSaleEmail(saleId);
            if (!result.ok) {
                return NextResponse.json({
                    error: 'Error al enviar el correo.',
                    detail: result.error
                }, { status: 500 });
            }

            return NextResponse.json({ ok: true, message: '¡Correo reenviado con éxito desde el panel administrativo!', numbers: result.numbers });
        } catch (error: any) {
            if (error.message === 'SALE_NOT_FOUND') {
                return NextResponse.json({ error: 'La venta no existe.' }, { status: 404 });
            }
            throw error;
        }

    } catch (error: any) {
        console.error('[Admin Resend API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
