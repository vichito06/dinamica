
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus, TicketStatus } from "@prisma/client";

export const runtime = "nodejs";

function mustEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

export async function POST(req: Request) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const TOKEN = mustEnv("PAYPHONE_TOKEN");
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

        if (sale.status !== SaleStatus.PENDING) {
            return NextResponse.json({ error: `La venta está en estado ${sale.status}` }, { status: 400 });
        }

        // Anti-duplicate & Expiry check
        const now = new Date();
        const invalidTickets = sale.tickets.filter(t =>
            t.status !== TicketStatus.HELD || (t.reservedUntil && t.reservedUntil < now)
        );

        if (invalidTickets.length > 0) {
            return NextResponse.json({
                error: 'La reserva de los tickets ha expirado o ya no son válidos',
                expiredNumbers: invalidTickets.map(t => t.number)
            }, { status: 410 });
        }

        // PayPhone amounts in cents (integers)
        const amount = Math.round(sale.amountCents);
        const amountWithoutTax = amount;
        const amountWithTax = 0;
        const tax = 0;
        const service = 0;
        const tip = 0;

        // Internal Validation: amount == sum(others)
        const sum = amountWithoutTax + amountWithTax + tax + service + tip;
        if (amount !== sum) {
            return NextResponse.json({
                error: "Validación interna falló: El monto total no coincide con la suma de componentes.",
                detail: `Total: ${amount}, Suma: ${sum}`
            }, { status: 400 });
        }

        // Use a robust clientTransactionId
        const clientTransactionId = sale.clientTransactionId || `SALE${sale.id}_${Date.now()}`;

        // Construct payload with real customer data (BillTo) and LineItems
        const customer = await prisma.customer.findUnique({
            where: { id: sale.customerId }
        });

        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const payload: any = {
            amount,
            clientTransactionId,
            currency: "USD",
            storeId: STORE_ID,
            reference: body.reference || `Compra tickets Dinámica - ${saleId}`,
            responseUrl: `${APP_URL}/payphone/return`,
            cancellationUrl: `${APP_URL}/payphone/cancel`,
            timeZone: -5,
            email: customer.email,
            documentId: customer.idNumber,
            phoneNumber: customer.phone.startsWith('+') ? customer.phone : `+593${customer.phone.replace(/^0/, '')}`,
            order: {
                billTo: {
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email,
                    phoneNumber: customer.phone.startsWith('+') ? customer.phone : `+593${customer.phone.replace(/^0/, '')}`,
                    address1: "Ecuador", // Generic if not stored
                    country: "EC",
                    customerId: customer.idNumber
                },
                lineItems: sale.tickets.map(t => ({
                    productName: `Ticket #${t.number}`,
                    unitPrice: Math.round(sale.amountCents / sale.tickets.length),
                    quantity: 1,
                    totalAmount: Math.round(sale.amountCents / sale.tickets.length),
                    taxAmount: 0,
                    productSKU: String(t.number),
                    productDescription: `Ticket de rifa número ${t.number}`
                }))
            }
        };

        if (amountWithoutTax > 0) payload.amountWithoutTax = amountWithoutTax;
        if (amountWithTax > 0) payload.amountWithTax = amountWithTax;
        if (tax > 0) payload.tax = tax;
        if (service > 0) payload.service = service;
        if (tip > 0) payload.tip = tip;

        const res = await fetch("https://pay.payphonetodoesposible.com/api/button/V2/Prepare", {
            method: "POST",
            headers: {
                Authorization: `bearer ${TOKEN}`,
                "Content-Type": "application/json",
                "Referer": `${APP_URL}/`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const text = await res.text();
        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) {
            console.error('[PayPhone Prepare] Error Status:', res.status);
            console.error('[PayPhone Prepare] Body Snippet:', text.slice(0, 500));
            return NextResponse.json(
                {
                    error: "Payphone Prepare failed (Upstream Error)",
                    upstreamStatus: res.status,
                    detail: text.slice(0, 800)
                },
                { status: 502 }
            );
        }

        if (!contentType.includes("application/json")) {
            console.error('[PayPhone Prepare] Non-JSON Response:', contentType);
            return NextResponse.json(
                {
                    error: "Payphone returned non-JSON response",
                    code: "PAYPHONE_NON_JSON",
                    contentType,
                    detail: text.slice(0, 800)
                },
                { status: 502 }
            );
        }

        const data = JSON.parse(text); // { paymentId, payWithPayPhone, payWithCard }

        if (data.paymentId) {
            await prisma.sale.update({
                where: { id: sale.id },
                data: {
                    payphonePaymentId: String(data.paymentId),
                    clientTransactionId: clientTransactionId
                }
            });
        }

        return NextResponse.json(data);
    } catch (e: any) {
        if (e.name === 'AbortError') {
            return NextResponse.json({ error: "Payphone request timed out (10s)" }, { status: 504 });
        }
        console.error('[PayPhone Prepare] Exception:', e);
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    } finally {
        clearTimeout(timeoutId);
    }
}
