import { NextResponse } from 'next/server';
import { confirmSale, getSales, getSalesSearch } from '@/lib/json-db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || undefined;

    const sales = await getSalesSearch(q);
    return NextResponse.json(sales);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('[API POST /sales] Payload received:', JSON.stringify(body, null, 2));
        const { personalData, tickets, total, sessionId } = body;

        // Validation
        if (!tickets || tickets.length === 0) {
            return NextResponse.json({ error: 'No tickets selected' }, { status: 400 });
        }

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID missing' }, { status: 400 });
        }

        // Process Sale (Confirm Reservation)
        const sale = await confirmSale(
            {
                firstName: personalData.firstName || '',
                lastName: personalData.lastName || '',
                fullName: personalData.name || `${personalData.lastName} ${personalData.firstName}`.trim(),
                email: personalData.email,
                idNumber: personalData.idNumber || '',
                phone: personalData.phone || '',
                country: personalData.country || 'Ecuador',
                province: personalData.province || '',
                city: personalData.city || '',
                postalCode: personalData.postalCode || ''
            },
            tickets.map((t: number) => t.toString().padStart(4, '0')), // Ensure ID format
            total,
            sessionId
        );

        return NextResponse.json({ success: true, sale });

    } catch (error: any) {
        if (error.message && error.message.includes('no están disponibles')) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }

        console.error('Sale error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
