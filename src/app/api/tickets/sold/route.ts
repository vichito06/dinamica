import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveRaffleId } from '@/lib/raffle';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const raffleId = await getActiveRaffleId();
        const sold = await prisma.ticket.findMany({
            where: {
                raffleId,
                status: 'SOLD'
            },
            select: {
                number: true
            }
        });

        // Map to string array of numbers to maintain compatibility if needed
        const numbers = sold.map(t => t.number.toString().padStart(4, '0'));

        return NextResponse.json(numbers, {
            headers: {
                'Cache-Control': 's-maxage=10, stale-while-revalidate=60'
            }
        });
    } catch (error: any) {
        console.error('[Tickets Sold API Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
