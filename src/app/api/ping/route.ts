// Force deploy at 2026-02-17 22:12
import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ ok: true, message: "pong", timestamp: new Date().toISOString() });
}
