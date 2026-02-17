import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SaleStatus, TicketStatus } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET(request: Request) {
    try {
        // Optional: Verify Vercel Cron header
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return new Response('Unauthorized', { status: 401 });
        // }

        const now = new Date();

        // Find expired tickets that are HELD
        const expiredTickets = await prisma.ticket.findMany({
            where: {
                status: TicketStatus.RESERVED,
                reservedUntil: { lt: now }
            },
            include: { sale: true }
        });

        if (expiredTickets.length === 0) {
            return NextResponse.json({ message: 'No expired tickets found' });
        }

        const expiredSaleIds = [...new Set(expiredTickets.map(t => t.saleId).filter(Boolean) as string[])];

        console.log(`[Cleanup] Found ${expiredTickets.length} expired tickets from ${expiredSaleIds.length} sales.`);

        // Transaction to release tickets and expire sales
        await prisma.$transaction(async (tx) => {
            // 1. Release Tickets
            await tx.ticket.updateMany({
                where: {
                    id: { in: expiredTickets.map(t => t.id) }
                },
                data: {
                    status: TicketStatus.AVAILABLE,
                    reservedUntil: null,
                    saleId: null
                }
            });

            // 2. Expire Sales
            // Only expire sales that are PENDING
            await tx.sale.updateMany({
                where: {
                    id: { in: expiredSaleIds },
                    status: SaleStatus.PENDING
                },
                data: {
                    status: SaleStatus.EXPIRED
                }
            });
        });

        return NextResponse.json({
            success: true,
            releasedTickets: expiredTickets.length,
            expiredSales: expiredSaleIds.length
        });

    } catch (error: any) {
        console.error('[Cleanup] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
