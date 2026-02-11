import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
    const appUrl = (process.env.APP_URL || "").trim().replace(/\/+$/, "");

    return NextResponse.json({
        ok: true,
        env: {
            tokenPresent: !!process.env.PAYPHONE_TOKEN,
            storeIdPresent: !!process.env.PAYPHONE_STORE_ID,
            appUrlPresent: !!appUrl,
            baseUrlPresent: !!process.env.PAYPHONE_BASE_URL,
            cancelUrlPresent: !!process.env.PAYPHONE_CANCEL_URL,
            debugSecretPresent: !!process.env.PAYPHONE_DEBUG_SECRET,
        },
        appUrl,
        referrerPolicyHint: "origin-when-cross-origin required"
    });
}
