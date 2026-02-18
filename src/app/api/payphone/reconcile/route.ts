import { NextResponse } from "next/server";
import { reconcileSale } from "@/lib/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payphone/reconcile
 * Cuerpo: { saleId }
 * 
 * Permite reconciliar manualmente una venta (usado por el botón "Ya pagué")
 */
export async function POST(req: Request) {
    try {
        const { saleId } = await req.json();

        if (!saleId) {
            return NextResponse.json({ ok: false, error: 'saleId is required' }, { status: 400 });
        }

        console.log(`[API Reconcile] Manual request for sale ${saleId}`);
        const result = await reconcileSale(saleId);

        if (!result.ok) {
            return NextResponse.json(result, { status: result.status === 'NOT_FOUND' ? 404 : 500 });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[API Reconcile] Crash:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
