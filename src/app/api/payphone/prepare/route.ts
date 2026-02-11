
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus } from "@prisma/client";
import { payphonePrepare, PayphonePreparePayload } from "@/lib/payphone-client";

export const runtime = "nodejs";

function mustEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

export async function POST(req: Request) {
    try {
        const STORE_ID = mustEnv("PAYPHONE_STORE_ID");
        const APP_URL = mustEnv("APP_URL");

        const body = await req.json();
        const { saleId } = body;

        if (!saleId) {
            return NextResponse.json({ error: 'Missing saleId' }, { status: 400 });
        }

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { tickets: true }
        });

        if (!sale) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        if (sale.status !== SaleStatus.PENDING && sale.status !== 'PENDING_PAYMENT' as any) {
            return NextResponse.json({ error: `La venta no está pendiente (${sale.status})` }, { status: 400 });
        }

        const amount = Math.round(sale.amountCents);
        const amountWithoutTax = amount;

        // Use a robust clientTransactionId (cut to 16 chars)
        const clientTransactionId = (sale.clientTransactionId || `S${sale.id}_${Date.now()}`).slice(0, 16);

        // Minimal stable payload (NO order/billTo details to avoid upstream 500s)
        const payload: PayphonePreparePayload = {
            amount,
            amountWithoutTax,
            clientTransactionId,
            currency: "USD",
            storeId: STORE_ID,
            reference: body.reference || `Rifa Dinámica #${saleId}`,
            responseUrl: `${APP_URL}/payphone/return`,
            cancellationUrl: `${APP_URL}/payphone/cancel`,
            timeZone: -5,
        };

        const result = await payphonePrepare(payload);

        if (!result.ok) {
            console.error('[PayPhone Prepare] Error:', result.status, result.text);
            return NextResponse.json({
                ok: false,
                error: "PayPhone Prepare failed (Upstream Error)",
                upstreamStatus: result.status,
                detail: result.isJson ? result.data : result.text?.slice(0, 800)
            }, { status: 502 });
        }

        const { payWithCard, paymentId } = result.data;

        // Update Sale with PayPhone data
        await prisma.sale.update({
            where: { id: saleId },
            data: {
                payphonePaymentId: String(paymentId),
                clientTransactionId: clientTransactionId
            }
        });

        return NextResponse.json({
            ok: true,
            payWithCard,
            paymentId,
            clientTransactionId
        });

    } catch (error: any) {
        console.error('[PayPhone Prepare API] Crash:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
