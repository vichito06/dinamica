
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
    return NextResponse.json({
        ok: true,
        stable: "3.0.0-FINAL",
        env: {
            tokenPresent: !!process.env.PAYPHONE_TOKEN,
            storeIdPresent: !!process.env.PAYPHONE_STORE_ID,
            appUrlPresent: !!process.env.APP_URL,
            debugSecretPresent: !!process.env.PAYPHONE_DEBUG_SECRET,
        },
        timestamp: new Date().toISOString()
    });
}
