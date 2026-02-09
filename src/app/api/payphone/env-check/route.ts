export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const secret = req.headers.get("x-test-secret");
    const expectedSecret = process.env.PAYPHONE_TEST_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keysToCheck = [
        "PAYPHONE_TOKEN",
        "PAYPHONE_CLIENT_ID",
        "PAYPHONE_SECRET",
        "PAYPHONE_ENCODING_PASSWORD",
        "PAYPHONE_APP_ID",
        "PAYPHONE_STORE_ID",
        "PAYPHONE_TEST_SECRET"
    ];

    const missing: string[] = [];
    const present: Record<string, boolean> = {};
    const lengths: Record<string, number> = {};

    keysToCheck.forEach((key) => {
        const value = process.env[key];
        const exists = Boolean(value && value.length > 0);
        present[key] = exists;
        if (exists) {
            lengths[key] = value!.length;
        } else {
            missing.push(key);
        }
    });

    // logic for 'ok': true si PAYPHONE_TOKEN y PAYPHONE_CLIENT_ID existen
    const ok = present["PAYPHONE_TOKEN"] && present["PAYPHONE_CLIENT_ID"];

    const response = Response.json({
        ok,
        missing,
        present,
        lengths,
        runtime: process.env.NEXT_RUNTIME || "nodejs",
        timestamp: new Date().toISOString()
    });

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
}
