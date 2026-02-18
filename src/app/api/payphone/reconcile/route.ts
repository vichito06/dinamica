import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconcileSale } from "@/lib/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payphone/reconcile
 * Cuerpo: { saleId, paymentId }
 * 
 * Permite reconciliar manualmente una venta.
 * Soporta búsqueda por saleId o paymentId (fallback crítico para móvil).
 */
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const saleId = String(body?.saleId ?? "").trim();
        const paymentIdRaw = body?.paymentId ?? body?.id;
        const paymentId = paymentIdRaw !== undefined ? Number(paymentIdRaw) : NaN;

        let sale = null;

        // 1. Buscar por saleId si existe
        if (saleId) {
            sale = await prisma.sale.findUnique({ where: { id: saleId } });
        }

        // 2. Fallback: Buscar por paymentId (o clientTransactionId como string)
        if (!sale && !isNaN(paymentId)) {
            sale = await prisma.sale.findFirst({
                where: {
                    OR: [
                        { payphonePaymentId: String(paymentId) }, // En la DB suele ser String
                        { clientTransactionId: String(paymentId) }
                    ]
                },
                orderBy: { createdAt: 'desc' }
            });
        }

        if (!sale) {
            console.error(`[API Reconcile] Sale not found. saleId:${saleId}, paymentId:${paymentId}`);
            return NextResponse.json({
                ok: false,
                code: "NOT_FOUND",
                error: "No se encontró la venta para reconciliar."
            }, { status: 404 });
        }

        console.log(`[API Reconcile] Reconciling sale ${sale.id} (Found by ${saleId ? 'saleId' : 'paymentId'})`);
        const result = await reconcileSale(sale.id);

        return NextResponse.json({
            ...result,
            saleId: sale.id
        }, { status: result.ok ? 200 : (result.status === 'NOT_FOUND' ? 404 : 500) });

    } catch (error: any) {
        console.error('[API Reconcile] Crash:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
