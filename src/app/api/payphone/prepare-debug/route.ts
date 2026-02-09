export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const secret = req.headers.get("x-test-secret");
    if (secret !== process.env.TEST_SECRET) {
        return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = process.env.PAYPHONE_TOKEN;
    const storeId = process.env.PAYPHONE_STORE_ID;
    const url = "https://pay.payphonetodoesposible.com/api/button/Prepare";

    const payload = {
        amount: 100, // $1.00
        amountWithoutTax: 100,
        amountWithTax: 0,
        tax: 0,
        service: 0,
        tip: 0,
        currency: "USD",
        reference: "DEBUG-TEST",
        clientTransactionId: `DEBUG-${Date.now()}`,
        storeId,
        responseUrl: "https://yvossoeee.com/payphone/return",
        cancellationUrl: "https://yvossoeee.com/payphone/cancel"
    };

    try {
        const r = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Origin": "https://yvossoeee.com",
                "Referer": "https://yvossoeee.com/"
            },
            body: JSON.stringify(payload)
        });

        const raw = await r.text();
        return Response.json({
            ok: r.ok,
            status: r.status,
            headers: Object.fromEntries(r.headers.entries()),
            bodyPreview: raw.slice(0, 1000),
            parsed: tryParse(raw)
        });

    } catch (e: any) {
        return Response.json({
            ok: false,
            error: e.message,
            stack: e.stack
        }, { status: 500 });
    }
}

function tryParse(str: string) {
    try {
        return JSON.parse(str);
    } catch {
        return "NON-JSON";
    }
}
