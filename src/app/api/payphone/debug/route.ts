import { requirePayphoneTestSecret } from "@/lib/payphone-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const auth = requirePayphoneTestSecret(req);
    if (!auth.ok) return Response.json(auth.body, { status: auth.status });

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
