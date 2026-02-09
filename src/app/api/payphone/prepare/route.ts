export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.PAYPHONE_BASE_URL || "https://pay.payphonetodoesposible.com";

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
    try {
        const { saleId } = await req.json();

        if (!saleId) return Response.json({ error: "saleId requerido" }, { status: 400 });

        const token = process.env.PAYPHONE_TOKEN;
        const storeId = process.env.PAYPHONE_STORE_ID; // Optional now

        if (!token || !storeId) {
            const missing = [];
            if (!token) missing.push("PAYPHONE_TOKEN");
            if (!storeId) missing.push("PAYPHONE_STORE_ID");

            console.error(`[Payphone Prepare] Missing config: ${missing.join(", ")}`);
            return Response.json({ error: "Configuration Error", missing }, { status: 500 });
        }

        await releaseExpiredReservations();

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { reservedTickets: true },
        });

        if (!sale) return Response.json({ error: "Venta no existe" }, { status: 404 });
        if (sale.status !== "PENDING") {
            console.warn(`[Payphone Prepare] Sale ${saleId} is ${sale.status}, not PENDING`);
            return Response.json({ error: "Venta no está PENDING" }, { status: 409 });
        }

        // Verifica que los tickets sigan reservados para esta venta
        const now = new Date();
        const badTicket = sale.reservedTickets.find(
            (t) => t.status !== "RESERVED" || t.reservedBySaleId !== sale.id || (t.reservedUntil && t.reservedUntil < now)
        );
        if (badTicket) {
            console.warn(`[Payphone Prepare] Sale ${saleId} has invalid/expired tickets`);
            return Response.json({ error: "Tickets no están reservados correctamente" }, { status: 409 });
        }

        const clientTransactionId = `SALE-${sale.id}-${Date.now()}`;
        console.log(`[Payphone Prepare] Preparing sale ${sale.id} with clientTxId ${clientTransactionId}`);

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
            responseUrl: process.env.PAYPHONE_RESPONSE_URL,
            cancellationUrl: `${process.env.PAYPHONE_CANCEL_URL}?id=${sale.id}`,
            timeZone: -5,
        };

        const r = await fetch(`${BASE_URL}/api/button/Prepare`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await r.json();

        if (!r.ok) {
            console.error("[Payphone Prepare] API Error:", data);
            return Response.json({ error: "Prepare falló", details: data }, { status: 400 });
        }

        // Guarda ids PayPhone en la venta
        await prisma.sale.update({
            where: { id: sale.id },
            data: {
                payphonePaymentId: data.paymentId ? String(data.paymentId) : undefined,
                payphoneClientTxId: clientTransactionId,
            },
        });

        console.log(`[Payphone Prepare] Success. Sale ${saleId} linked to Payphone ID ${data.paymentId}`);

        return Response.json({
            payUrl: data.payWithCard || data.payWithPayPhone,
            paymentId: data.paymentId,
            clientTransactionId,
        });
    } catch (error) {
        console.error("[Payphone Prepare] Internal Error:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
