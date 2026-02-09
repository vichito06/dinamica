export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const secret = req.headers.get("x-test-secret");
    const expected = process.env.TEST_SECRET;

    if (!expected || secret !== expected) {
        return new Response("Unauthorized", { status: 401 });
    }

    const envs = {
        PAYPHONE_TOKEN: Boolean(process.env.PAYPHONE_TOKEN),
        PAYPHONE_STORE_ID: Boolean(process.env.PAYPHONE_STORE_ID),
        PAYPHONE_BASE_URL_HOST: process.env.PAYPHONE_BASE_URL,
        PAYPHONE_CLIENT_ID: Boolean(process.env.PAYPHONE_CLIENT_ID),
        PAYPHONE_SECRET: Boolean(process.env.PAYPHONE_SECRET),
        PAYPHONE_RESPONSE_URL: process.env.PAYPHONE_RESPONSE_URL,
        PAYPHONE_CANCEL_URL: process.env.PAYPHONE_CANCEL_URL,
        NODE_ENV: process.env.NODE_ENV
    };

    return Response.json({
        ok: true,
        envs,
        timestamp: new Date().toISOString()
    });
}
