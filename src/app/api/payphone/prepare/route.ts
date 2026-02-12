
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus } from "@prisma/client";
import { payphoneRequestWithRetry } from "@/lib/payphoneClient";

export const runtime = "nodejs";

function mustEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

export async function POST(req: Request) {
    const requestId = crypto.randomUUID();
    let body;

    try {
        body = await req.json();
    } catch (e) {
        return NextResponse.json({
            ok: false,
            code: "INVALID_JSON",
            message: "Invalid JSON in request body",
            requestId
        }, { status: 400 });
    }

    try {
        const STORE_ID = mustEnv("PAYPHONE_STORE_ID");
        const APP_URL = mustEnv("APP_URL");

        const { saleId } = body;

        if (!saleId) {
            return NextResponse.json({
                ok: false,
                code: "MISSING_SALE_ID",
                message: "Missing saleId",
                requestId
            }, { status: 400 });
        }

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { tickets: true }
        });

        if (!sale) {
            return NextResponse.json({
                ok: false,
                code: "SALE_NOT_FOUND",
                message: "Sale not found",
                requestId
            }, { status: 404 });
        }

        // Idempotencia: Si ya tiene un payWithCardUrl y está PENDING, devolverlo
        if (sale.payWithCardUrl && sale.status === SaleStatus.PENDING) {
            console.log(`[PayPhone Prepare] [${requestId}] Returning cached URL for sale ${saleId}`);
            return NextResponse.json({
                ok: true,
                data: {
                    payWithCard: sale.payWithCardUrl,
                    // Note: We might want to store payWithPayPhoneUrl too if we want full idempotency for both
                    paymentId: sale.payphonePaymentId,
                    clientTransactionId: sale.clientTransactionId,
                    cached: true
                }
            });
        }

        // Validar estado
        if (sale.status !== SaleStatus.PENDING && (sale.status as string) !== 'PENDING_PAYMENT') {
            return NextResponse.json({
                ok: false,
                code: "INVALID_SALE_STATUS",
                message: `La venta no está pendiente (${sale.status})`,
                requestId
            }, { status: 400 });
        }

        const amount = Math.round(sale.amountCents);
        const amountWithoutTax = amount;

        // Use a robust clientTransactionId (fixed to 16 chars)
        const clientTransactionId = (sale.clientTransactionId || `S${sale.id}_${Date.now()}`).slice(0, 16);

        // Payload EXACTO requerido por PayPhone
        const payload = {
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

        // Llamada a PayPhone usando Axios con reintentos
        const result = await payphoneRequestWithRetry({
            method: 'POST',
            url: '/button/Prepare',
            data: payload
        }, 2, requestId);

        if (!result.ok) {
            const isNonJson = !result.isJson;
            console.error(`[PayPhone Prepare] [${requestId}] Request failed. Status: ${result.status}. Content-Type: ${result.contentType}`);

            return NextResponse.json({
                ok: false,
                code: isNonJson ? "PAYPHONE_NON_JSON" : "PAYPHONE_ERROR",
                status: result.status,
                message: isNonJson ? "PayPhone returned an invalid response (HTML/Text)" : "PayPhone request failed",
                snippet: result.snippet,
                requestId
            }, { status: 502 });
        }

        // PayPhone returns payWithCard and payWithPayPhone (fallback is PayPhone index)
        const { payWithCard, payWithPayPhone, paymentId } = result.data;

        // Actualizar la venta
        await prisma.sale.update({
            where: { id: saleId },
            data: {
                payphonePaymentId: String(paymentId),
                clientTransactionId: clientTransactionId,
                payWithCardUrl: payWithCard,
                preparedAt: new Date()
            }
        });

        return NextResponse.json({
            ok: true,
            data: {
                payWithPayPhone, // Priorizar este en el front
                payWithCard,      // Fallback
                paymentId,
                clientTransactionId
            }
        });

    } catch (error: any) {
        console.error(`[PayPhone Prepare API] [${requestId}] Crash:`, error);
        return NextResponse.json({
            ok: false,
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Internal Server Error",
            requestId
        }, { status: 500 });
    }
}


