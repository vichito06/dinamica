import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sha(s: string) {
    return createHash("sha256").update(s).digest("hex").slice(0, 12);
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const inputRaw = String(body?.password ?? "");
        const envRaw = String(process.env.ADMIN_PASSWORD ?? "");
        const secretRaw = String(process.env.ADMIN_SESSION_SECRET ?? "");

        // Normalización básica
        const input = inputRaw.trim();
        const env = envRaw.trim();
        const secret = secretRaw.trim();

        const ok = input === env && env.length > 0;

        if (!ok) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Contraseña incorrecta",
                    debug: {
                        hasEnv: Boolean(envRaw),
                        statusEnv: envRaw ? "present" : "missing",
                        envLen: env.length,
                        inputLen: input.length,
                        envHash: sha(env),
                        inputHash: sha(input),
                        envFirst: env.slice(0, 2),
                    },
                },
                { status: 401 }
            );
        }

        if (!secret) {
            return NextResponse.json(
                { success: false, error: 'Configuración incompleta (SECRET)' },
                { status: 500 }
            );
        }

        // Éxito: Crear sesión
        const sessionToken = secret;
        const cookieStore = await cookies();
        const oneDay = 24 * 60 * 60;

        cookieStore.set('admin_session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: oneDay,
            path: '/',
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
