import { NextResponse } from 'next/server';
import { reserveTickets } from '@/lib/json-db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tickets, sessionId } = body;

        if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
            return NextResponse.json({ error: 'No tickets provided' }, { status: 400 });
        }

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }

        const result = reserveTickets(tickets, sessionId);

        if (!result.success) {
            return NextResponse.json({
                error: 'Algunos números ya han sido reservados o comprados.',
                unavailable: result.unavailable
            }, { status: 409 });
        }

        return NextResponse.json({ success: true, message: 'Tickets reserved successfully' });

    } catch (error) {
        console.error('Reservation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
