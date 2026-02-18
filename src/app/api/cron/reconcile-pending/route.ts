import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconcileSale } from "@/lib/reconciliation";
import { SaleStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/reconcile-pending
 * Protegido por CRON_SECRET
 * 
 * Busca ventas PENDING de las últimas 24 horas y las reconcilia con PayPhone.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const querySecret = searchParams.get('secret');
    const authHeader = req.headers.get('authorization');
    const secret = process.env.CRON_SECRET;

    const isAuthorized = secret && (
        (authHeader === `Bearer ${secret}`) ||
        (querySecret === secret)
    );

    if (!isAuthorized) {
        console.warn(`[CRON Reconcile] Unauthorized attempt. Query: ${!!querySecret}, Header: ${!!authHeader}`);
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Buscar ventas PENDING que tengan datos de PayPhone
        const pendingSales = await prisma.sale.findMany({
            where: {
                status: SaleStatus.PENDING,
                createdAt: { gte: twentyFourHoursAgo },
                payphonePaymentId: { not: null as any },
                clientTransactionId: { not: null as any }
            },
            take: 20 // Procesar en lotes pequeños para evitartimeouts
        });

        console.log(`[CRON Reconcile] Found ${pendingSales.length} pending sales to process.`);

        const results = [];
        for (const sale of pendingSales) {
            const result = await reconcileSale(sale.id);
            results.push({
                saleId: sale.id,
                status: result.status,
                ok: result.ok
            });
        }

        return NextResponse.json({
            ok: true,
            processed: pendingSales.length,
            results
        });

    } catch (error: any) {
        console.error('[CRON Reconcile] Crash:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
