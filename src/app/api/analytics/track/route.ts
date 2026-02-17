import { NextResponse } from 'next/server';
import { incrementAnalytics } from '@/lib/analytics-db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, path, sessionId } = body;

        if (type === 'pageview' || type === 'unique') {
            await incrementAnalytics(type, path, sessionId);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
