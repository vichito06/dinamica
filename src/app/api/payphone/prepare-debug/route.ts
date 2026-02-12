
import { requirePayphoneTestSecret } from "@/lib/payphone-auth";
import { payphoneRequestWithRetry, payphoneAxios } from "@/lib/payphoneClient";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function handler(req: Request) {
    const requestId = crypto.randomUUID();

    // 1. Auth check
    const auth = requirePayphoneTestSecret(req);
    if (!auth.ok) return Response.json(auth.body, { status: auth.status });

    const STORE_ID = (process.env.PAYPHONE_STORE_ID ?? "").trim();
    const APP_URL = (process.env.APP_URL || "").trim().replace(/\/+$/, "");

    if (!STORE_ID) {
        return Response.json({ ok: false, error: "Missing PAYPHONE_STORE_ID", requestId }, { status: 500 });
    }

    const clientTransactionId = `DBG${Date.now()}`.toUpperCase().slice(0, 16);

    // Minimal stable payload
    const payload = {
        amount: 100,
        amountWithoutTax: 100,
        currency: "USD",
        clientTransactionId,
        storeId: STORE_ID,
        reference: "DIAGNOSTIC STABILITY TEST",
        responseUrl: `${APP_URL}/payphone/return`,
        cancellationUrl: `${APP_URL}/payphone/cancel`,
        timeZone: -5,
    };

    const result = await payphoneRequestWithRetry({
        method: 'POST',
        url: '/button/Prepare',
        data: payload
    }, 0, requestId); // No retries for debug

    return NextResponse.json({
        ok: result.ok,
        requestId,
        diagnostics: {
            baseURL: payphoneAxios.defaults.baseURL,
            endpoint: '/button/Prepare',
            tokenPresent: !!process.env.PAYPHONE_TOKEN,
            storeIdLen: STORE_ID.length,
            payloadSent: { ...payload, storeId: 'HIDDEN' },
            upstreamStatus: result.status,
            contentType: result.contentType,
            timing: result.timing,
            snippet: result.snippet // HTML or non-JSON snippet
        },
        data: result.data // JSON data if successful
    }, { status: result.ok ? 200 : (result.status || 502) });
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }

