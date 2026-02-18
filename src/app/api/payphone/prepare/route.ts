import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import crypto from 'crypto';
import { SaleStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { payphoneRequestWithRetry } from "@/lib/payphoneClient";

export const maxDuration = 60;
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
            console.log(`[PayPhone Prepare][${requestId}] Returning cached URL for sale ${saleId}`);
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
                message: `La venta no está pendiente(${sale.status})`,
                requestId
            }, { status: 400 });
        }

        // Cálculo de montos en CENTAVOS (Requerido por PayPhone: $1.00 = 100)
        const qty = sale.tickets.length;
        const ticketPriceCents = 100; // $1.00 por ticket
        const amountCents = qty * ticketPriceCents;
        const totalUsd = amountCents / 100;

        // Logs SOLO para admin/debug
        const isAdmin = req.headers.get("cookie")?.includes("admin_auth=true") ||
            req.headers.get("x-test-secret") === process.env.TEST_SECRET;

        if (isAdmin) {
            console.log(`[PayPhone Prepare][${requestId}] Calculation: USD:${totalUsd}, Cents:${amountCents}, Qty:${qty}, Price:${ticketPriceCents} `);
        }

        // Validación mínima: PayPhone requiere al menos $1
        if (amountCents < 100) {
            return NextResponse.json({
                ok: false,
                code: "AMOUNT_TOO_LOW",
                message: "PayPhone requiere un monto mínimo de $1 (100 centavos).",
                requestId
            }, { status: 400 });
        }

        const amount = amountCents;
        const amountWithoutTax = amountCents;
        const amountWithTax = 0;
        const tax = 0;
        const service = 0;
        const jar = await cookies();
        const session = jar.get('admin_session')?.value ?? jar.get('admin_auth')?.value;
        const secret = (process.env.ADMIN_SESSION_SECRET ?? "").trim();
        const isUserAdmin = session && session === secret;
        const tip = 0;

        // Use a robust clientTransactionId (fixed to 16 chars)
        const clientTransactionId = (sale.clientTransactionId || `S${sale.id}_${Date.now()} `).slice(0, 16);

        // Payload EXACTO requerido por PayPhone (Debe cumplir: amount = sum of others)
        const payload = {
            amount,
            amountWithoutTax,
            amountWithTax,
            tax,
            service,
            tip,
            clientTransactionId,
            currency: "USD",
            storeId: STORE_ID,
            reference: "Y Voss Oeee — Compra de tickets",
            responseUrl: `${APP_URL} /payphone/return`,
            cancellationUrl: `${APP_URL} /payphone/cancel`,
            timeZone: -5,
        };

        // Admin override for testing
        if (isUserAdmin && body.testMode) {
            console.log("[PayPhone Prepare] Admin test mode detected");
        }

        // Llamada a PayPhone usando Axios con reintentos
        const result = await payphoneRequestWithRetry({
            method: 'POST',
            url: '/button/Prepare',
            data: payload
        }, 2, requestId);

        if (!result.ok) {
            console.error(`[PayPhone Prepare][${requestId}] Request failed.Status: ${result.status} `);

            return NextResponse.json({
                ok: false,
                code: "PAYPHONE_REJECTED",
                status: result.status,
                message: "PayPhone ha rechazado el pago.",
                payphone: result.data || result.snippet || "No response body",
                debug: isAdmin ? {
                    sentPayloadSummary: { amount, amountWithoutTax, amountWithTax, tax },
                    rawPayphoneBody: result.data,
                    contentType: result.contentType
                } : undefined,
                requestId
            }, { status: 400 }); // Retornar 400 para que el front lo maneje como rechazo del proveedor
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
                payWithPayPhone,
                payWithCard,
                paymentId,
                clientTransactionId
            }
        });

    } catch (error: any) {
        console.error(`[PayPhone Prepare API][${requestId}] Crash: `, error);

        const isAdmin = req.headers.get("cookie")?.includes("admin_auth=true") ||
            req.headers.get("x-test-secret") === process.env.TEST_SECRET;

        const sanitizedError = {
            message: error?.message || "Internal Server Error",
            code: error?.code,
            meta: error?.meta,
            stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
        };

        return NextResponse.json({
            ok: false,
            code: error.code || "INTERNAL_SERVER_ERROR",
            message: "Error al preparar el pago. Intente nuevamente.",
            debug: isAdmin ? sanitizedError : undefined,
            requestId
        }, { status: 500 });
    }
}


