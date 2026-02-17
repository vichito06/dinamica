
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const adminPassword = (process.env.ADMIN_PASSWORD ?? "").trim();
        const inputPassword = (password ?? "").trim();

        console.log("[ADMIN_LOGIN_ENV]", {
            hasEnv: Boolean(process.env.ADMIN_PASSWORD),
            len: (process.env.ADMIN_PASSWORD ?? "").length,
            first: (process.env.ADMIN_PASSWORD ?? "").slice(0, 3),
            last: (process.env.ADMIN_PASSWORD ?? "").slice(-3),
        });

        if (!adminPassword) {
            console.error('ADMIN_PASSWORD is not set in environment variables');
            return NextResponse.json(
                { error: 'Error de configuración del servidor' },
                { status: 500 }
            );
        }

        if (inputPassword === adminPassword) {
            // Set HttpOnly cookie
            const cookieStore = await cookies();
            // Set a cookie valid for 1 day
            const oneDay = 24 * 60 * 60 * 1000;

            cookieStore.set('admin_auth', 'true', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: oneDay,
                path: '/',
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { error: 'Contraseña incorrecta' },
            { status: 401 }
        );
    } catch (error) {
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
