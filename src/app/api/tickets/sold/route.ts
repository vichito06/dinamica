import { NextResponse } from 'next/server';
import { getSoldTickets } from '@/lib/json-db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const sold = await getSoldTickets();
    return NextResponse.json(sold, {
        headers: {
            'Cache-Control': 's-maxage=10, stale-while-revalidate=60'
        }
    });
}
