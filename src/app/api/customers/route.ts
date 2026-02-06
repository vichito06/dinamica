import { NextResponse } from 'next/server';
import { getCustomersSummary } from '@/lib/json-db';

export async function GET() {
    try {
        const customers = await getCustomersSummary();
        return NextResponse.json(customers);
    } catch (error) {
        console.error('Error fetching customers summary:', error);
        return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
}
