import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('admin_session')?.value ?? cookieStore.get('admin_auth')?.value;
        const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();

        if (!session || session !== secret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q') || '';

        // Get Active Raffle
        const activeRaffle = await prisma.raffle.findFirst({ where: { status: 'ACTIVE' } });

        let where: any = { status: 'PAID' };
        if (activeRaffle) {
            where.raffleId = activeRaffle.id;
        }

        if (q) {
            where.OR = [
                { id: { contains: q, mode: 'insensitive' } },
                { customer: { firstName: { contains: q, mode: 'insensitive' } } },
                { customer: { lastName: { contains: q, mode: 'insensitive' } } },
                { customer: { idNumber: { contains: q, mode: 'insensitive' } } },
                { tickets: { some: { number: isNaN(parseInt(q)) ? -1 : parseInt(q) } } }
            ];
        }

        const sales = await prisma.sale.findMany({
            where,
            include: {
                customer: true,
                tickets: true
            },
            orderBy: { confirmedAt: 'desc' }
        });

        // Build CSV columns
        const headers = [
            'ID Venta',
            'Fecha Pago',
            'Cliente',
            'Cédula',
            'Email',
            'Teléfono',
            'Ciudad',
            'Monto',
            'Tickets Count',
            'Números'
        ];

        const rows = sales.map(s => [
            s.id,
            s.confirmedAt ? s.confirmedAt.toISOString() : '',
            `${s.customer?.firstName || ''} ${s.customer?.lastName || ''}`.trim(),
            s.customer?.idNumber || '',
            s.customer?.email || '',
            s.customer?.phone || '',
            s.customer?.city || '',
            (s.amountCents / 100).toFixed(2),
            s.tickets.length,
            (s.tickets || []).map(t => String(t.number).padStart(4, '0')).join(' - ')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        return new Response(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="ventas_${new Date().toISOString().split('T')[0]}.csv"`
            }
        });

    } catch (error: any) {
        console.error('[Export CSV] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
