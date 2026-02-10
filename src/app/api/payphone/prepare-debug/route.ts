export const runtime = "nodejs";
import { requirePayphoneTestSecret } from "@/lib/payphone-auth";

export async function GET(req: Request) {
    const requestId = crypto.randomUUID();
    const auth = requirePayphoneTestSecret(req);
    if (!auth.ok) return Response.json(auth.body, { status: auth.status });

    // Hyper-Clean token normalization
    const tokenRaw = process.env.PAYPHONE_TOKEN ?? "";
    const token = tokenRaw
        .trim()
        .replace(/^bearer\s+/i, "") // Remove prefix if it accidentally exists in env
        .replace(/[\r\n\t\s]+/g, "");

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

    const payload = {
        Amount: 100,
        AmountWithoutTax: 100,
        AmountWithTax: 0,
        Tax: 0,
        Service: 0,
        Tip: 0,
        ClientTransactionId: `YVOSSDEBUG${Date.now()}`.slice(0, 50),
        Currency: "USD",
        StoreId: storeId,
        Reference: "Compra Test",
        ResponseUrl: responseUrl,
        CancellationUrl: cancellationUrl || undefined,
        TimeZone: -5
    };

    console.log('[PayPhone Prepare Debug] Requesting:', url);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`, // Standard uppercase
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const raw = await res.text();
        const contentType = res.headers.get("content-type") || "";

        if (!res.ok || !contentType.includes("application/json")) {
            // Enhanced diagnosis for HTML errors
            let htmlExtract = "";
            if (contentType.includes('text/html')) {
                const h1 = raw.match(/<h1>(.*?)<\/h1>/i)?.[1];
                const h2 = raw.match(/<h2>(.*?)<\/h2>/i)?.[1];
                const pre = raw.match(/<pre>([\s\S]*?)<\/pre>/i)?.[1];
                htmlExtract = (h1 || h2 || pre || "No specific error found in HTML").trim();
            }

            console.error('[PayPhone Prepare Debug] Server Error:', {
                status: res.status,
                contentType,
                extract: htmlExtract
            });

            return Response.json(
                {
                    ok: false,
                    code: contentType.includes('application/json') ? "PAYPHONE_UPSTREAM_ERROR" : "PAYPHONE_NON_JSON",
                    upstreamStatus: res.status,
                    contentType,
                    htmlExtract,
                    endpoint: url,
                    bodySnippet: raw.slice(0, 5000),
                    requestId
                },
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
