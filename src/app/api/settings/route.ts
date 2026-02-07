import { NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/json-db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const settings = await getSettings();
    return NextResponse.json(settings);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Basic validation could go here
        const updated = await updateSettings(body);
        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
