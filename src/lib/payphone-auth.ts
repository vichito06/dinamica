import { NextRequest } from "next/server";

export type PayphoneAuthResponse =
    | { ok: true }
    | { ok: false; status: 401 | 503; body: { ok: false; code: string; missing?: string[] } };

export function requirePayphoneTestSecret(req: Request | NextRequest): PayphoneAuthResponse {
    const expected = process.env.PAYPHONE_DEBUG_SECRET;

    if (!expected) {
        return {
            ok: false,
            status: 503,
            body: {
                ok: false,
                code: "DEBUG_SECRET_MISSING",
                missing: ["PAYPHONE_DEBUG_SECRET"]
            },
        };
    }

    const provided = req.headers.get("x-test-secret") || "";
    if (provided !== expected) {
        return {
            ok: false,
            status: 401,
            body: { ok: false, code: "UNAUTHORIZED_DEBUG" },
        };
    }

    return { ok: true };
}
