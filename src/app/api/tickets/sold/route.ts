import { NextResponse } from 'next/server';
import { getSoldTickets } from '@/lib/json-db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const sold = getSoldTickets();
    return NextResponse.json(sold);
}
