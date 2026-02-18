
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SaleStatus } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('admin_session')?.value ?? cookieStore.get('admin_auth')?.value;
        const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();

        if (!session || session !== secret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get Active Raffle
        const activeRaffle = await prisma.raffle.findFirst({
            where: { status: 'ACTIVE' }
        });

        const raffleId = activeRaffle?.id;

        const customers = await prisma.customer.findMany({
            where: raffleId ? {
                sales: {
                    some: { raffleId: raffleId }
                }
            } : {},
            include: {
                sales: {
                    where: raffleId ? { raffleId: raffleId } : {},
                    include: {
                        tickets: {
                            where: raffleId ? { raffleId: raffleId } : {}
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate stats for each customer
        const formattedCustomers = customers.map(c => {
            const paidOrPendingSales = c.sales.filter(s => s.status === SaleStatus.PAID || s.status === SaleStatus.PENDING);
            // In admin, we might want to see all sales, or just paid? 
            // Usually "Ventas" implies success or at least intent. 
            // Let's include all non-canceled/expired for stats to match "active" view, 
            // OR strictly PAID. The prompt says "Métricas reales".
            // Let's stick to PAID for "Total" and "Tickets", but maybe show pending in a separate way?
            // For simplicity and "real money", let's count PAID.

            const realSales = (c.sales || []).filter(s => s.status === SaleStatus.PAID);

            const totalCents = realSales.reduce((sum, sale) => sum + (sale.amountCents || 0), 0);
            const totalTickets = realSales.reduce((sum, sale) => sum + (sale.tickets?.length || 0), 0);

            return {
                id: c.id,
                fullName: `${c.lastName || ''} ${c.firstName || ''}`.trim() || 'S/N',
                email: c.email || 'S/N',
                idNumber: c.idNumber || 'S/N',
                phone: c.phone || 'S/N',
                province: '',
                country: 'Ecuador',
                stats: {
                    ventas: realSales.length,
                    tickets: totalTickets,
                    total: totalCents / 100
                }
            };
        });

        return NextResponse.json(formattedCustomers);

    } catch (error) {
        console.error('Error fetching customers:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
