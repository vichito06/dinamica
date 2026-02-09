export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const requestId = crypto.randomUUID();

    // Validar content-type
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        return Response.json({ ok: false, code: "INVALID_CONTENT_TYPE", error: "Content-Type must be application/json", requestId }, { status: 400 });
    }

    try {
        const bodyText = await req.text();
        let body;
        try {
            body = JSON.parse(bodyText);
        } catch (e) {
            return Response.json({ ok: false, code: "INVALID_JSON_BODY", error: "Invalid JSON body", requestId }, { status: 400 });
        }

        const { saleId } = body;

        if (!saleId) {
            return Response.json({ ok: false, code: "MISSING_SALE_ID", error: "saleId requerido", requestId }, { status: 400 });
        }

        const token = process.env.PAYPHONE_TOKEN;
        const storeId = process.env.PAYPHONE_STORE_ID;

        // Critical Env Check
        const missing = [];
        if (!token) missing.push("PAYPHONE_TOKEN");
        if (!storeId) missing.push("PAYPHONE_STORE_ID");

        if (missing.length > 0) {
            console.error(`[Payphone Prepare] [${requestId}] Missing config: ${missing.join(", ")}`);
            return Response.json({ ok: false, code: "SERVER_CONFIG_ERROR", error: "Server Configuration Error", missing, requestId }, { status: 500 });
        }

        // Release expired reservations before creating new one
        await releaseExpiredReservations();

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { reservedTickets: true },
        });

        if (!sale) {
            return Response.json({ ok: false, code: "SALE_NOT_FOUND", error: "Venta no existe", requestId, saleId }, { status: 404 });
        }

        if (sale.status !== "PENDING") {
            console.warn(`[Payphone Prepare] [${requestId}] Sale ${saleId} is ${sale.status}, not PENDING`);
            return Response.json({ ok: false, code: "SALE_NOT_PENDING", error: "Venta no está PENDING", requestId }, { status: 409 });
        }

        const clientTransactionId = `SALE-${sale.id}-${Date.now()}`;
        console.log(`[Payphone Prepare] [${requestId}] Preparing sale ${sale.id} with clientTxId ${clientTransactionId}`);

        // Construct payload strictly according to PayPhone docs
        const amountCents = Math.round(sale.amountCents); // Ensure integer

        const payload: any = {
            amount: amountCents,
            amountWithoutTax: amountCents,
            amountWithTax: 0,
            tax: 0,
            service: 0,
            tip: 0,
            currency: sale.currency || "USD",
            reference: `DIN1-${sale.id}`,
            clientTransactionId: clientTransactionId,
            storeId: storeId,
            responseUrl: process.env.PAYPHONE_RESPONSE_URL || "https://yvossoeee.com/payphone/return",
            cancellationUrl: process.env.PAYPHONE_CANCEL_URL ? `${process.env.PAYPHONE_CANCEL_URL}?id=${sale.id}` : `https://yvossoeee.com/payphone/cancel?id=${sale.id}`,
        };

        // Strict URL as requested
        const targetUrl = "https://pay.payphonetodoesposible.com/api/button/Prepare";
        const truncatedUrl = targetUrl.slice(0, 80);
        console.log(`[Payphone Prepare] [${requestId}] Sending request to ${truncatedUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        let r;
        try {
            r = await fetch(targetUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`,
                    // Reinforce Origin/Referer to avoid blocking
                    "Origin": "https://yvossoeee.com",
                    "Referer": "https://yvossoeee.com/",
                    "User-Agent": "YVossOeee-Backend/1.0"
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                console.error(`[Payphone Prepare] [${requestId}] Timeout waiting for Payphone`);
                return Response.json({ ok: false, code: "PAYPHONE_TIMEOUT", error: "Payphone upstream timeout", requestId }, { status: 504 });
            }
            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        console.log(`[Payphone Prepare] [${requestId}] Upstream status: ${r.status}`);

        const raw = await r.text();
        const ct = r.headers.get("content-type") || "";

        // Safe parse
        let data: any;
        try {
            // Trim and check if it starts with { or [ to avoid parsing HTML
            const isJson = (ct.includes("application/json") || raw.trim().startsWith("{") || raw.trim().startsWith("["));
            if (isJson) {
                data = JSON.parse(raw);
            } else {
                throw new Error("Non-JSON content");
            }
        } catch (e) {
            console.error(`[Payphone Prepare] [${requestId}] Non-JSON response: ${r.status}`, raw.slice(0, 500));
            return Response.json({
                ok: false,
                code: "PAYPHONE_NON_JSON",
                error: "PayPhone returned non-JSON",
                bodyPreview: raw.slice(0, 500),
                status: r.status,
                requestId
            }, { status: 502 });
        }

        if (!r.ok) {
            console.error(`[Payphone Prepare] [${requestId}] Upstream NOT OK: ${r.status}`, data);
            return Response.json({
                ok: false,
                code: "PAYPHONE_UPSTREAM_ERROR",
                error: "PayPhone Error",
                status: r.status,
                bodyPreview: data,
                requestId
            }, { status: 502 });
        }

        // Save PayPhone IDs
        await prisma.sale.update({
            where: { id: sale.id },
            data: {
                payphonePaymentId: data.paymentId ? String(data.paymentId) : undefined,
                payphoneClientTxId: clientTransactionId,
            },
        });

        console.log(`[Payphone Prepare] [${requestId}] Success. Sale ${saleId} linked to Payphone ID ${data.paymentId}`);

        // Return standardized successful response
        return Response.json({
            ok: true,
            requestId,
            transactionId: clientTransactionId,
            url: data.payWithCard || data.payWithPayPhone,
            paymentId: data.paymentId,
            // Debug info if needed, but keeping it clean
        });

    } catch (error: any) {
        console.error(`[Payphone Prepare] [${requestId}] Internal Error:`, error);
        return Response.json({ ok: false, code: "INTERNAL_ERROR", error: "Internal Server Error", requestId }, { status: 500 });
    }
}

async function releaseExpiredReservations() {
    try {
        const now = new Date();
        const result = await prisma.ticket.updateMany({
            where: {
                status: "RESERVED",
                reservedUntil: { lt: now },
            },
            data: {
                status: "AVAILABLE",
                reservedUntil: null,
                reservedBySaleId: null,
            },
        });
        if (result.count > 0) {
            console.log(`[Payphone Prepare] Released ${result.count} expired tickets`);
        }
    } catch (e) {
        // Non-critical, just log
        console.error("[Payphone Prepare] Error releasing expired reservations:", e);
    }
}
