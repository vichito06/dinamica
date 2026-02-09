export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const secret = req.headers.get("x-test-secret");
    const expected = process.env.TEST_SECRET;

    // 1. Si no hay TEST_SECRET configurado en Vercel, falla seguro (500)
    if (!expected) {
        return Response.json(
            { ok: false, error: "TEST_SECRET missing in environment" },
            { status: 500 }
        );
    }

    // 2. Si el header no coincide (o falta), 401 JSON
    if (secret !== expected) {
        return Response.json(
            { ok: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    // 3. Todo OK
    const envs = {
        PAYPHONE_TOKEN: Boolean(process.env.PAYPHONE_TOKEN),
        PAYPHONE_STORE_ID: Boolean(process.env.PAYPHONE_STORE_ID),
        PAYPHONE_BASE_URL: Boolean(process.env.PAYPHONE_BASE_URL),
        PAYPHONE_RESPONSE_URL: Boolean(process.env.PAYPHONE_RESPONSE_URL),
        PAYPHONE_CANCEL_URL: Boolean(process.env.PAYPHONE_CANCEL_URL),
        TEST_SECRET: Boolean(process.env.TEST_SECRET),
        NODE_ENV: process.env.NODE_ENV
    };

    return Response.json({
        ok: true,
        envs,
        timestamp: new Date().toISOString()
    });
}
