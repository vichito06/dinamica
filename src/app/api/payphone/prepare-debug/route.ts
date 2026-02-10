export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const requestId = crypto.randomUUID();

    const envSecret = process.env.TEST_SECRET;
    if (!envSecret) {
        return Response.json({ ok: false, code: "MISSING_TEST_SECRET", requestId }, { status: 500 });
    }

    const headerSecret = req.headers.get("x-test-secret");
    if (headerSecret !== envSecret) {
        return Response.json({ ok: false, code: "UNAUTHORIZED", requestId }, { status: 401 });
    }

    const token = process.env.PAYPHONE_TOKEN;
    const storeId = process.env.PAYPHONE_STORE_ID;

    if (!token || !storeId) {
        return Response.json({ ok: false, code: "MISSING_PAYPHONE_CONFIG", requestId }, { status: 500 });
    }

    const baseUrl = process.env.PAYPHONE_BASE_URL || "https://pay.payphonetodoesposible.com";
    const endpoint = "/api/button/Prepare";

    const payload = {
        amount: 100, // 100 cents = $1.00 for stable testing
        amountWithoutTax: 100,
        amountWithTax: 0,
        tax: 0,
        service: 0,
        tip: 0,
        currency: "USD",
        reference: "DEBUG-TEST-V2",
        clientTransactionId: `DEBUG-${Date.now()}`,
        storeId: storeId,
        responseUrl: process.env.PAYPHONE_RESPONSE_URL || "https://yvossoeee.com/payphone/return",
        cancellationUrl: process.env.PAYPHONE_CANCEL_URL || "https://yvossoeee.com/payphone/cancel",
        timeZone: -5
    };

    // Format Authorization Header
    const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

    try {
        const r = await fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Origin": "https://yvossoeee.com",
                "Referer": "https://yvossoeee.com/",
                "User-Agent": "YVossOeee-Backend/Debug-V2"
            },
            body: JSON.stringify(payload)
        });

        const raw = await r.text();
        const ct = r.headers.get("content-type") || "";

        let data: any;
        try {
            data = JSON.parse(raw);
        } catch {
            console.error('[PayPhone Prepare Debug] Non-JSON response:', raw.slice(0, 500));
            return Response.json({
                ok: false,
                code: "PAYPHONE_NON_JSON",
                status: r.status,
                contentType: ct,
                bodySnippet: raw.slice(0, 500),
                requestId
            }, { status: 502 });
        }

        if (!r.ok) {
            return Response.json({
                ok: false,
                code: "PAYPHONE_UPSTREAM_ERROR",
                status: r.status,
                details: data,
                requestId
            }, { status: 502 });
        }

        const foundUrl = data.payWithCard || data.url || data.paymentUrl || data.link || data.redirectUrl || null;

        return Response.json({
            ok: true,
            requestId,
            status: r.status,
            rawKeys: Object.keys(data),
            url: foundUrl,
            details: data
        });

    } catch (e: any) {
        return Response.json({
            ok: false,
            code: "INTERNAL_ERROR",
            error: e.message,
            requestId
        }, { status: 500 });
    }
}
