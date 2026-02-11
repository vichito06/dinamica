
export const runtime = "nodejs";
import { requirePayphoneTestSecret } from "@/lib/payphone-auth";

export async function GET(req: Request) {
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    // 1. Auth check
    const auth = requirePayphoneTestSecret(req);
    if (!auth.ok) return Response.json(auth.body, { status: auth.status });

    // 2. Load and Clean Config
    const tokenRaw = process.env.PAYPHONE_TOKEN ?? "";
    const tokenLimpio = tokenRaw
        .trim()
        .replace(/^(bearer\s+|Bearer\s+)/i, "")
        .replace(/[\r\n\t\s]+/g, "");

    const authPrefix = tokenLimpio ? tokenLimpio.substring(0, 6) : "";
    const authPresent = tokenLimpio.length > 0;

    const storeId = (process.env.PAYPHONE_STORE_ID ?? "").trim();
    const baseUrl = (process.env.PAYPHONE_BASE_URL ?? "https://pay.payphonetodoesposible.com")
        .trim()
        .replace(/\/+$/, "");

    const responseUrl = (process.env.PAYPHONE_RESPONSE_URL || "https://yvossoeee.com/payphone/return").trim();
    const cancellationUrl = (process.env.PAYPHONE_CANCEL_URL || "https://yvossoeee.com/payphone/cancel").trim();

    if (!tokenLimpio || !storeId || !responseUrl) {
        return Response.json({ ok: false, error: "Missing PayPhone env", tokenLen: (tokenLimpio || "").length, requestId }, { status: 500 });
    }

    // Standard Endpoint URL (Minimalist)
    const url = `${baseUrl}/api/button/Prepare`;

    // Internal Validation Rule: amount == sum(others)
    const amount = 100;
    const amountWithoutTax = 100;
    const amountWithTax = 0;
    const tax = 0;
    const service = 0;
    const tip = 0;

    const payload: any = {
        amount: 100,
        amountWithoutTax: 100,
        amountWithTax: 0,
        tax: 0,
        service: 0,
        tip: 0,
        clientTransactionId: `YVOSS${Date.now()}`.toUpperCase().slice(0, 16),
        currency: "USD",
        storeId,
        reference: "DEBUG TEST V2",
        responseUrl,
        cancellationUrl: cancellationUrl || "https://yvossoeee.com/",
        timeZone: "-5",
        order: {
            billTo: {
                firstName: "Rifa",
                lastName: "Debug",
                email: "debug@yvossoeee.com",
                phoneNumber: "+593999999999",
                address1: "Quito",
                country: "EC",
                customerId: "9999999999"
            }
        }
    };

    console.log('[PayPhone Prepare Debug] Requesting:', url);

    try {
        const appUrl = (process.env.APP_URL || "https://yvossoeee.com").trim().replace(/\/+$/, "");

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `bearer ${tokenLimpio}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Referer": `${appUrl}/`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const raw = await res.text();
        const contentType = res.headers.get("content-type") || "";

        const debugInfo = {
            ok: res.ok,
            upstreamStatus: res.status,
            contentType,
            authPresent,
            authPrefix: authPrefix ? `${authPrefix}...` : "NONE",
            requestId,
            storeIdLen: storeId.length,
            endpoint: url,
            payloadSent: { ...payload, storeId: 'HIDDEN' },
            bodySnippet: raw.slice(0, 800)
        };

        if (!res.ok || !contentType.includes("application/json")) {
            console.error('[PayPhone Prepare Debug] Minimalist Server Error:', {
                status: res.status,
                contentType,
                requestId
            });

            return Response.json(
                {
                    ...debugInfo,
                    code: contentType.includes('application/json') ? "PAYPHONE_UPSTREAM_ERROR" : "PAYPHONE_NON_JSON"
                },
                { status: 502 }
            );
        }

        const data = JSON.parse(raw);
        return Response.json({
            ...debugInfo,
            payphoneResponse: data
        });

    } catch (e: any) {
        if (e.name === 'AbortError') {
            return Response.json({ ok: false, error: "Payphone request timed out (10s)", requestId }, { status: 504 });
        }
        console.error('[PayPhone Prepare Debug] Exception:', e);
        return Response.json({
            ok: false,
            code: "INTERNAL_ERROR",
            error: e.message,
            requestId
        }, { status: 500 });
    } finally {
        clearTimeout(timeoutId);
    }
}
