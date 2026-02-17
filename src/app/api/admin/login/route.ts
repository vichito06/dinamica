import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHmac } from 'crypto';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        const normalize = (s: string | undefined | null) =>
            (s ?? "").trim().replace(/\.+$/, ""); // quita SOLO puntos al final

        const adminPassword = normalize(process.env.ADMIN_PASSWORD);
        const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();

        if (!adminPassword || !secret) {
            return NextResponse.json(
                { success: false, error: 'Missing environment configuration' },
                { status: 500 }
            );
        }

        const inputPassword = normalize(password);

        if (inputPassword === adminPassword) {
            // Create a signed session token
            // HMAC(payload, secret)
            const signature = createHmac('sha256', secret)
                .update('admin-session')
                .digest('hex');

            const cookieStore = await cookies();

            // Set for 24 hours
            const oneDay = 24 * 60 * 60;

            cookieStore.set('admin_session', signature, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: oneDay,
                path: '/',
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { success: false, error: 'Contraseña incorrecta' },
            { status: 401 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
