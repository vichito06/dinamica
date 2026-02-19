import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
        const rl = await rateLimit(`track:${ip}`, 30, 60);
        if (!rl.success) {
            return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
        }

        const body = await req.json().catch(() => ({}));

        const event = String(body?.event || "");
        const raffleId = String(body?.raffleId || "");
        const visitorId = String(body?.visitorId || "");
        const path = String(body?.path || "/");

        // mínimo indispensable
        if (!event || !raffleId) {
            return NextResponse.json({ ok: false }, { status: 200 }); // NO romper tracking
        }

        await prisma.analyticsEvent.create({
            data: {
                event,
                raffleId,
                visitorId: visitorId || null,
                path,
                userAgent: String(body?.ua || ""),
                createdAt: new Date(body?.ts ? Number(body.ts) : Date.now()),
            },
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error("[TRACK_API] Error saving analytics event:", e);
        // jamás tumbar visitas por errores
        return NextResponse.json({ ok: false }, { status: 200 });
    }
}
