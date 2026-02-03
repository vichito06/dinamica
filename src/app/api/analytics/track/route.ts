import { NextResponse } from 'next/server';
import { incrementAnalytics } from '@/lib/analytics-db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type } = body;

        if (type === 'pageview' || type === 'unique') {
            incrementAnalytics(type);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
