import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { createHmac } from 'crypto';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('admin_session')?.value;
        const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();

        if (!session || !secret) {
            return NextResponse.json({ authenticated: false });
        }

        if (session === secret) {
            return NextResponse.json({ authenticated: true });
        }

        return NextResponse.json({ authenticated: false });
    } catch (error) {
        return NextResponse.json({ authenticated: false });
    }
}
