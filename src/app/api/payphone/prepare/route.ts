export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

// User requested NO fallback if envs are missing to avoid HTML errors.
const BASE_URL = process.env.PAYPHONE_BASE_URL;

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
        console.error("[Payphone Prepare] Error releasing expired reservations:", e);
    }
}

export async function POST(req: Request) {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
        const bodyText = await req.text();
        let body;
        try {
            body = JSON.parse(bodyText);
        } catch (e) {
            return Response.json({ error: "Invalid JSON body", requestId }, { status: 400 });
        }

        const { saleId } = body;

        if (!saleId) return Response.json({ error: "saleId requerido", requestId }, { status: 400 });

        const token = process.env.PAYPHONE_TOKEN;
        const storeId = process.env.PAYPHONE_STORE_ID;

        // Critical Env Check
        const missing = [];
        if (!token) missing.push("PAYPHONE_TOKEN");
        if (!storeId) missing.push("PAYPHONE_STORE_ID");
        if (!BASE_URL) missing.push("PAYPHONE_BASE_URL");

        if (missing.length > 0) {
            console.error(`[Payphone Prepare] [${requestId}] Missing config: ${missing.join(", ")}`);
            return Response.json({ error: "Server Configuration Error", missing, requestId }, { status: 500 });
        }

        await releaseExpiredReservations();

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { reservedTickets: true },
        });

        if (!sale) return Response.json({ error: "Venta no existe", requestId }, { status: 404 });
        if (sale.status !== "PENDING") {
            console.warn(`[Payphone Prepare] [${requestId}] Sale ${saleId} is ${sale.status}, not PENDING`);
            return Response.json({ error: "Venta no está PENDING", requestId }, { status: 409 });
        }

        // Verifica que los tickets sigan reservados para esta venta
        const now = new Date();
        const badTicket = sale.reservedTickets.find(
            (t) => t.status !== "RESERVED" || t.reservedBySaleId !== sale.id || (t.reservedUntil && t.reservedUntil < now)
        );
        if (badTicket) {
            console.warn(`[Payphone Prepare] [${requestId}] Sale ${saleId} has invalid/expired tickets`);
            return Response.json({ error: "Tickets no están reservados correctamente", requestId }, { status: 409 });
        }

        const clientTransactionId = `SALE-${sale.id}-${Date.now()}`;
        console.log(`[Payphone Prepare] [${requestId}] Preparing sale ${sale.id} with clientTxId ${clientTransactionId}`);

        // Construct payload.
        const payload: any = {
            storeId,
            amount: sale.amountCents,
            amountWithoutTax: sale.amountCents,
            amountWithTax: 0,
            tax: 0,
            service: 0,
            tip: 0,
            currency: sale.currency,
            reference: `DIN1-${sale.id}`,
            clientTransactionId,
            responseUrl: process.env.PAYPHONE_RESPONSE_URL || "https://yvossoeee.com/payphone/return",
            cancellationUrl: process.env.PAYPHONE_CANCEL_URL ? `${process.env.PAYPHONE_CANCEL_URL}?id=${sale.id}` : `https://yvossoeee.com/payphone/cancel?id=${sale.id}`,
            timeZone: -5,
        };

        const targetUrl = `${BASE_URL}/api/button/Prepare`;
        console.log(`[Payphone Prepare] [${requestId}] Sending request to ${targetUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        let r;
        try {
            r = await fetch(targetUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                console.error(`[Payphone Prepare] [${requestId}] Timeout waiting for Payphone`);
                return Response.json({ error: "Payphone upstream timeout", requestId }, { status: 504 });
            }
            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        const raw = await r.text();
        const ct = r.headers.get("content-type") || "";

        console.log(`[Payphone Prepare] [${requestId}] Received status ${r.status} type ${ct}`);

        if (!r.ok) {
            console.error(`[Payphone Prepare] [${requestId}] Upstream NOT OK: ${r.status}`, raw.slice(0, 500));
            return Response.json({ error: "PayPhone upstream error", status: r.status, requestId }, { status: 502 });
        }

        let data: any;
        try {
            data = ct.includes("application/json") || raw.trim().startsWith("{") ? JSON.parse(raw) : JSON.parse(raw);
        } catch {
            console.error(`[Payphone Prepare] [${requestId}] Non-JSON response: ${r.status}`, raw.slice(0, 500));
            return Response.json({ error: "PayPhone returned non-JSON", status: r.status, requestId }, { status: 502 });
        }

        // Guarda ids PayPhone en la venta
        await prisma.sale.update({
            where: { id: sale.id },
            data: {
                payphonePaymentId: data.paymentId ? String(data.paymentId) : undefined,
                payphoneClientTxId: clientTransactionId,
            },
        });

        console.log(`[Payphone Prepare] [${requestId}] Success. Sale ${saleId} linked to Payphone ID ${data.paymentId} in ${Date.now() - startTime}ms`);

        const payUrl = data.payWithCard || data.payWithPayPhone || data.paymentUrl || data.url;

        return Response.json({
            payUrl,
            paymentId: data.paymentId,
            clientTransactionId,
            requestId
        });
    } catch (error) {
        console.error(`[Payphone Prepare] [${requestId}] Internal Error:`, error);
        return Response.json({ error: "Internal Server Error", requestId }, { status: 500 });
    }
}
