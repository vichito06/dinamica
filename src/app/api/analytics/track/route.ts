import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
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
