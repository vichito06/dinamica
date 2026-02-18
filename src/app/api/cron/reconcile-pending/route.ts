import { NextResponse } from "next/server";
import { reconcilePendingSales } from "@/lib/reconciliation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const url = new URL(req.url);

    const secretQuery = url.searchParams.get("secret");
    const auth = req.headers.get("authorization") ?? "";
    const secretHeader = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    const expected = process.env.CRON_SECRET ?? "";

    const ok = expected && (secretQuery === expected || secretHeader === expected);
    if (!ok) {
        console.error("[CRON] unauthorized", { hasQuery: !!secretQuery, hasHeader: !!secretHeader });
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    try {
        const result = await reconcilePendingSales({ lookbackHours: 24 });
        return NextResponse.json({ ok: true, ...result });
    } catch (error: any) {
        console.error("[CRON] Crash:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
