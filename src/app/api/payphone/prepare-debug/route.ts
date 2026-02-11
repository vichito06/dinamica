
import { requirePayphoneTestSecret } from "@/lib/payphone-auth";
import { payphonePrepare, PayphonePreparePayload } from "@/lib/payphone-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
    const requestId = crypto.randomUUID();

    // 1. Auth check
    const auth = requirePayphoneTestSecret(req);
    if (!auth.ok) return Response.json(auth.body, { status: auth.status });

    const STORE_ID = (process.env.PAYPHONE_STORE_ID ?? "").trim();
    const APP_URL = (process.env.APP_URL || "https://yvossoeee.com").trim().replace(/\/+$/, "");

    if (!STORE_ID) {
        return Response.json({ ok: false, error: "Missing PAYPHONE_STORE_ID", requestId }, { status: 500 });
    }

    const clientTransactionId = `DBG${Date.now()}`.toUpperCase().slice(0, 16);

    // Minimal stable payload
    const payload: PayphonePreparePayload = {
        amount: 100,
        amountWithoutTax: 100,
        currency: "USD",
        clientTransactionId,
        storeId: STORE_ID,
        reference: "STABLE DEBUG V3",
        responseUrl: `${APP_URL}/payphone/return`,
        cancellationUrl: `${APP_URL}/payphone/cancel`,
        timeZone: -5,
    };

    const result = await payphonePrepare(payload);

    return NextResponse.json({
        ok: result.ok,
        upstreamStatus: result.status,
        contentType: result.isJson ? "application/json" : "text/html",
        authPresent: !!process.env.PAYPHONE_TOKEN,
        requestId,
        storeIdLen: STORE_ID.length,
        payloadSent: { ...payload, storeId: 'HIDDEN' },
        data: result.data,
        bodySnippet: result.text ? result.text.slice(0, 1000) : undefined
    }, { status: result.ok ? 200 : (result.status || 502) });
}
