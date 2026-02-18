import { NextResponse } from "next/server";
import { reconcilePendingSales } from "@/lib/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const url = new URL(req.url);

    const expected = process.env.CRON_SECRET ?? "";
    const secretQuery = url.searchParams.get("secret") ?? "";
    const auth = req.headers.get("authorization") ?? "";
    const secretHeader = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    const authorized =
        expected.length > 0 && (secretQuery === expected || secretHeader === expected);

    if (!authorized) {
        console.error("[CRON] unauthorized", {
            hasQuery: !!secretQuery,
            hasHeader: !!secretHeader,
        });
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    try {
        const result = await reconcilePendingSales({ lookbackHours: 24 });
        return NextResponse.json({ ok: true, ...result });
    } catch (err: any) {
        console.error("[CRON] Crash:", err);
        return NextResponse.json(
            { ok: false, error: err?.message ?? "cron_failed" },
            { status: 500 }
        );
    }
}
