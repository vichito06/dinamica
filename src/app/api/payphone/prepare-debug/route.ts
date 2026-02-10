export const runtime = "nodejs";
import { requirePayphoneTestSecret } from "@/lib/payphone-auth";

export async function GET(req: Request) {
    const requestId = crypto.randomUUID();
    const auth = requirePayphoneTestSecret(req);
    if (!auth.ok) return Response.json(auth.body, { status: auth.status });

    // Hyper-Clean token normalization (V2 Patch)
    const tokenRaw = process.env.PAYPHONE_TOKEN ?? "";
    const tokenLimpio = tokenRaw
        .trim()
        .replace(/^(bearer\s+|Bearer\s+)/i, "")
        .replace(/[\r\n\t\s]+/g, "");

    const storeId = (process.env.PAYPHONE_STORE_ID ?? "").trim();
    const baseUrl = (process.env.PAYPHONE_BASE_URL ?? "https://pay.payphonetodoesposible.com")
        .trim()
        .replace(/\/+$/, "");

    const responseUrl = (process.env.PAYPHONE_RESPONSE_URL || "https://yvossoeee.com/payphone/return").trim();
    const cancellationUrl = (process.env.PAYPHONE_CANCEL_URL || "https://yvossoeee.com/payphone/cancel").trim();

    if (!tokenLimpio || !storeId || !responseUrl) {
        return Response.json({ ok: false, error: "Missing PayPhone env", tokenLen: (tokenLimpio || "").length, requestId }, { status: 500 });
    }

    // Correct V2 Endpoint URL
    const url = `${baseUrl}/api/button/V2/Prepare`;

    const payload = {
        amount: 100,
        amountWithoutTax: 100,
        amountWithTax: 0,
        tax: 0,
        service: 0,
        tip: 0,
        // Alphanumeric Only
        clientTransactionId: `YVOSS${Date.now()}${Math.random().toString(36).slice(2, 8)}`.toUpperCase().slice(0, 50),
        currency: "USD",
        storeId,
        reference: "TEST YVOSS V2",
        responseUrl,
        cancellationUrl: cancellationUrl || undefined,
        timeZone: -5,
        lat: "0.0",
        lng: "0.0"
    };

    console.log('[PayPhone Prepare Debug] Requesting:', url);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                // Using standard "Bearer" (Uppercase) which PayPhone's IIS server often requires
                "Authorization": `Bearer ${tokenLimpio}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "PayPhone-SDK-Node/1.0"
            },
            body: JSON.stringify(payload)
        });

        const raw = await res.text();
        const contentType = res.headers.get("content-type") || "";

        if (!res.ok || !contentType.includes("application/json")) {
            // Precise diagnosis for HTML errors
            let htmlExtract = "";
            if (contentType.includes('text/html')) {
                const h1 = raw.match(/<h1>(.*?)<\/h1>/i)?.[1];
                const h2 = raw.match(/<h2>(.*?)<\/h2>/i)?.[1];
                const desc = raw.match(/<b> Description: <\/b>(.*?)<br>/i)?.[1];
                htmlExtract = (h1 || h2 || desc || "No identified error tag in HTML").trim();
            }

            console.error('[PayPhone Prepare Debug] V2 Server Error:', {
                status: res.status,
                contentType,
                extract: htmlExtract,
                url
            });

            return Response.json(
                {
                    ok: false,
                    code: contentType.includes('application/json') ? "PAYPHONE_UPSTREAM_ERROR" : "PAYPHONE_NON_JSON",
                    upstreamStatus: res.status,
                    contentType,
                    htmlExtract,
                    endpoint: url,
                    payloadSent: { ...payload, storeId: 'HIDDEN' },
                    bodySnippet: raw.slice(0, 5000),
                    requestId
                },
                { status: 502 }
            );
        }

        const data = JSON.parse(raw);
        return Response.json({
            ok: true,
            endpoint: url,
            payloadSent: { ...payload, storeId: 'HIDDEN' },
            payphoneResponse: data
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
