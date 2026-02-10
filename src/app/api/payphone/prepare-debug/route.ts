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

    // Check minimal requirements for the call
    if (!token || !storeId) {
        return Response.json({ ok: false, code: "MISSING_PAYPHONE_CONFIG", requestId }, { status: 500 });
    }

    const url = "https://pay.payphonetodoesposible.com/api/button/Prepare";

    const payload = {
        amount: 100, // 100 cents = $1.00 for stable testing
        amountWithoutTax: 100,
        amountWithTax: 0,
        tax: 0,
        service: 0,
        tip: 0,
        currency: "USD",
        reference: "DEBUG-TEST",
        clientTransactionId: `DEBUG-${Date.now()}`,
        // Using provided storeId or fallback to env if passed
        storeId: process.env.PAYPHONE_STORE_ID,
        responseUrl: process.env.PAYPHONE_RESPONSE_URL || "https://yvossoeee.com/payphone/return",
        cancellationUrl: process.env.PAYPHONE_CANCEL_URL || "https://yvossoeee.com/payphone/cancel",
        ...((req as any).body || {}) // Allow overriding for debug if needed, but safe defaults first
    };

    try {
        const r = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Origin": "https://yvossoeee.com",
                "Referer": "https://yvossoeee.com/",
                "User-Agent": "YVossOeee-Backend/Debug"
            },
            body: JSON.stringify(payload)
        });

        const raw = await r.text();
        const ct = r.headers.get("content-type") || "";

        // Try parse
        let data: any;
        try {
            data = JSON.parse(raw);
        } catch {
            return Response.json({
                ok: false,
                code: "PAYPHONE_NON_JSON",
                status: r.status,
                bodySnippet: raw.slice(0, 500),
                requestId
            }, { status: 502 });
        }

        if (!r.ok) {
            return Response.json({
                ok: false,
                code: "PAYPHONE_UPSTREAM_ERROR",
                status: r.status,
                bodySnippet: data,
                requestId
            }, { status: 502 });
        }

        // Extract URL
        // PayPhone usually returns `payWithCard`. I will check multiple fields as requested.
        const foundUrl = data.payWithCard || data.url || data.paymentUrl || data.link || data.redirectUrl || null;

        return Response.json({
            ok: true,
            requestId,
            status: r.status,
            rawKeys: Object.keys(data),
            url: foundUrl,
            // Include full data for debug if needed, but user asked for specific fields. 
            // "ok:true, requestId, status:res.status, rawKeys:[...], url:<campo url encontrado o null>"
            // I will include bodySnippet just in case
            bodySnippet: data
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
