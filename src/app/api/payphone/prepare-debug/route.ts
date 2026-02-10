export const runtime = "nodejs";
import { requirePayphoneTestSecret } from "@/lib/payphone-auth";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const requestId = crypto.randomUUID();

    const auth = requirePayphoneTestSecret(req);
    if (!auth.ok) return Response.json(auth.body, { status: auth.status });

    // Exact PayPhone configuration from user requirements
    const tokenRaw = process.env.PAYPHONE_TOKEN ?? "";
    const token = tokenRaw.replace(/\s+/g, ""); // Remove all whitespace/newlines

    const storeId = (process.env.PAYPHONE_STORE_ID ?? "").trim();
    const baseUrl = (process.env.PAYPHONE_BASE_URL ?? "https://pay.payphonetodoesposible.com")
        .trim()
        .replace(/\/+$/, "");

    const responseUrl = (process.env.PAYPHONE_RESPONSE_URL || "https://yvossoeee.com/payphone/return").trim();
    const cancellationUrl = (process.env.PAYPHONE_CANCEL_URL || "https://yvossoeee.com/payphone/cancel").trim();

    if (!token || !storeId || !responseUrl) {
        return Response.json({ ok: false, error: "Missing PayPhone env", tokenLen: token.length, requestId }, { status: 500 });
    }

    const url = `${baseUrl}/api/button/Prepare`;

    const clientTransactionId = `YVOSS-DEBUG-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const payload = {
        amount: 100,
        amountWithoutTax: 100,
        amountWithTax: 0,
        tax: 0,
        service: 0,
        tip: 0,
        clientTransactionId,
        reference: "TEST YVOSS DEBUG",
        storeId,
        currency: "USD",
        responseUrl,
        cancellationUrl: cancellationUrl || undefined,
        timeZone: -5,
        // User requested lat/lng to avoid possible validation issues
        lat: "-0.1807",
        lng: "-78.4678"
    };

    console.log('[PayPhone Prepare Debug] Requesting:', url);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`, // One single line
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "YVossOeee-Backend/Debug-V3"
            },
            body: JSON.stringify(payload)
        });

        const raw = await res.text();
        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) {
            console.error('[PayPhone Prepare Debug] Error:', res.status, raw.slice(0, 800));
            return Response.json(
                { ok: false, upstreamStatus: res.status, contentType, endpoint: url, bodySnippet: raw.slice(0, 800), requestId },
                { status: 502 }
            );
        }

        if (!contentType.includes("application/json")) {
            console.error('[PayPhone Prepare Debug] Non-JSON response received');
            return Response.json(
                { ok: false, code: "PAYPHONE_NON_JSON", upstreamStatus: res.status, contentType, endpoint: url, bodySnippet: raw.slice(0, 800), requestId },
                { status: 502 }
            );
        }

        const data = JSON.parse(raw);
        return Response.json({
            ok: true,
            requestId,
            status: res.status,
            url: data.payWithCard || data.url,
            details: data
        });

    } catch (e: any) {
        console.error('[PayPhone Prepare Debug] Exception:', e);
        return Response.json({
            ok: false,
            code: "INTERNAL_ERROR",
            error: e.message,
            requestId
        }, { status: 500 });
    }
}
