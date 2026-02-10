import { NextRequest } from "next/server";

export function requirePayphoneTestSecret(req: Request | NextRequest) {
    const expected =
        process.env.PAYPHONE_TEST_SECRET ??
        process.env.TEST_SECRET ??
        "";

    if (!expected) {
        return {
            ok: false as const,
            status: 500,
            body: { ok: false, error: "PAYPHONE_TEST_SECRET/TEST_SECRET missing in environment" },
        };
    }

    const provided = req.headers.get("x-test-secret") ?? "";
    if (provided !== expected) {
        return {
            ok: false as const,
            status: 401,
            body: { ok: false, error: "Unauthorized" },
        };
    }

    return { ok: true as const };
}
