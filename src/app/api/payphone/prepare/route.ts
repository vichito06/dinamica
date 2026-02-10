
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { SaleStatus, TicketStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { saleId } = body;

        if (!saleId) {
            return NextResponse.json({ error: 'Missing saleId' }, { status: 400 });
        }

        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { tickets: true, customer: true }
        });

        if (!sale) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        if (sale.status !== SaleStatus.PENDING_PAYMENT) {
            return NextResponse.json({ error: 'Sale is not pending payment' }, { status: 400 });
        }

        if (sale.amountCents <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        // Validate tickets
        const now = new Date();
        const invalidTickets = sale.tickets.filter(t =>
            t.status !== TicketStatus.RESERVED ||
            (t.reservedUntil && t.reservedUntil < now)
        );

        if (invalidTickets.length > 0) {
            return NextResponse.json({ error: 'Tickets expired or invalid' }, { status: 409 });
        }

        // Exact PayPhone configuration from user requirements
        const tokenRaw = process.env.PAYPHONE_TOKEN ?? "";
        const token = tokenRaw.replace(/\s+/g, ""); // Remove all whitespace/newlines

        const storeId = (process.env.PAYPHONE_STORE_ID ?? "").trim();
        const baseUrl = (process.env.PAYPHONE_BASE_URL ?? "https://pay.payphonetodoesposible.com")
            .trim()
            .replace(/\/+$/, "");

        const responseUrl = (process.env.PAYPHONE_RESPONSE_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'https://yvossoeee.com'}/payphone/return`).trim();
        const cancellationUrl = (process.env.PAYPHONE_CANCEL_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'https://yvossoeee.com'}/payphone/cancel`).trim();

        if (!token || !storeId || !responseUrl) {
            console.error('[PayPhone Prepare] Missing required environment variables');
            return NextResponse.json({ error: 'Configuración de PayPhone incompleta', details: 'Faltan variables de entorno' }, { status: 500 });
        }

        const url = `${baseUrl}/api/button/Prepare`;

        // Strict calculation
        const amount = sale.amountCents;
        const amountWithoutTax = amount;
        const amountWithTax = 0;
        const tax = 0;
        const service = 0;
        const tip = 0;

        // Verify sum rule: amount = amountWithoutTax + amountWithTax + tax + service + tip
        if (amount !== (amountWithoutTax + amountWithTax + tax + service + tip)) {
            return NextResponse.json({ error: 'Mismatch in amount calculation logic' }, { status: 400 });
        }

        const payload = {
            amount,
            amountWithoutTax,
            amountWithTax,
            tax,
            service,
            tip,
            clientTransactionId: String(sale.clientTransactionId),
            reference: `Venta Dinamica #${sale.id.slice(-6)}`,
            storeId,
            currency: "USD",
            responseUrl,
            cancellationUrl: cancellationUrl || undefined,
            timeZone: -5,
            // User requested lat/lng to avoid possible validation issues
            lat: "-0.1807",
            lng: "-78.4678"
        };

        console.log('[PayPhone Prepare] Requesting:', url);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`, // One single line, clean token
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
            console.error('[PayPhone Prepare] Error:', response.status, responseText.slice(0, 800));
            return NextResponse.json({
                error: 'PAYPHONE_UPSTREAM_ERROR',
                status: response.status,
                contentType,
                endpoint: url,
                bodySnippet: responseText.slice(0, 800)
            }, { status: 502 });
        }

        if (!contentType.includes('application/json')) {
            console.error('[PayPhone Prepare] Non-JSON response received');
            return NextResponse.json({
                error: 'PAYPHONE_NON_JSON',
                status: response.status,
                contentType,
                endpoint: url,
                bodySnippet: responseText.slice(0, 800)
            }, { status: 502 });
        }

        const responseData = JSON.parse(responseText);

        if (responseData.paymentId) {
            await prisma.sale.update({
                where: { id: sale.id },
                data: { payphonePaymentId: String(responseData.paymentId) }
            });
        }

        return NextResponse.json({
            redirectUrl: responseData.payWithCard || responseData.url,
            paymentId: responseData.paymentId
        });

    } catch (error: any) {
        console.error('[PayPhone Prepare] Exception:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
