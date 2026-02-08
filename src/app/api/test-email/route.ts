
import { NextResponse } from "next/server";
import { sendTicketsEmail } from "@/lib/email";

export const runtime = "nodejs";

// ✅ GET: prueba desde navegador con ?to=
export async function GET(req: Request) {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (key !== process.env.TEST_EMAIL_SECRET) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const to = url.searchParams.get("to");

    if (!to) {
        return NextResponse.json(
            { success: false, error: "Missing ?to=" },
            { status: 400 }
        );
    }

    const result = await sendTicketsEmail({
        to,
        customerName: "Cliente de Prueba",
        saleCode: "TEST-1234",
        tickets: ["0007", "0123", "0456"],
        total: 10,
    });

    return NextResponse.json(result);
}

// ✅ POST: prueba con PowerShell (body JSON)
export async function POST(req: Request) {
    const secret = req.headers.get("x-test-secret");
    if (secret !== process.env.TEST_EMAIL_SECRET) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const to = body?.to;

    if (!to) {
        return NextResponse.json(
            { success: false, error: "Missing to" },
            { status: 400 }
        );
    }

    const result = await sendTicketsEmail({
        to,
        customerName: "Cliente de Prueba",
        saleCode: "TEST-1234",
        tickets: ["0007", "0123", "0456"],
        total: 10,
    });

    return NextResponse.json(result);
}
