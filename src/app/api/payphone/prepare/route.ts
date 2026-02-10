
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

        // Hyper-Clean token normalization (V2 Patch)
        const tokenRaw = process.env.PAYPHONE_TOKEN ?? "";
        const tokenLimpio = tokenRaw
            .trim()
            .replace(/^(bearer\s+|Bearer\s+)/i, "") // Radical prefix removal
            .replace(/[\r\n\t\s]+/g, "");

        const storeId = (process.env.PAYPHONE_STORE_ID ?? "").trim();
        const baseUrl = (process.env.PAYPHONE_BASE_URL ?? "https://pay.payphonetodoesposible.com")
            .trim()
            .replace(/\/+$/, "");

        const responseUrl = (process.env.PAYPHONE_RESPONSE_URL || "https://yvossoeee.com/payphone/return").trim();
        const cancellationUrl = (process.env.PAYPHONE_CANCEL_URL || "https://yvossoeee.com/payphone/cancel").trim();

        if (!tokenLimpio || !storeId || !responseUrl) {
            return NextResponse.json({ error: 'Configuración de PayPhone incompleta' }, { status: 500 });
        }

        // Correct V2 Endpoint URL
        const url = `${baseUrl}/api/button/V2/Prepare`;

        // Strict calculation (integers only)
        const amount = Math.round(sale.amountCents);
        const amountWithoutTax = amount;
        const amountWithTax = 0;
        const tax = 0;
        const service = 0;
        const tip = 0;

        if (amount !== (amountWithoutTax + amountWithTax + tax + service + tip)) {
            return NextResponse.json({ error: 'Sum validation failed' }, { status: 400 });
        }

        // Payload for V2 (camelCase + STRICTLY ALPHANUMERIC ID)
        const payload = {
            amount,
            amountWithoutTax,
            amountWithTax,
            tax,
            service,
            tip,
            // Strictly alphanumeric ID (Remove any _ from date/random)
            clientTransactionId: `YVOSS${Date.now()}${Math.random().toString(36).slice(2, 8)}`.toUpperCase().slice(0, 50),
            reference: "Compra Dinamica",
            storeId,
            currency: "USD",
            responseUrl,
            cancellationUrl: cancellationUrl || undefined,
            timeZone: -5,
            lat: "0.0",
            lng: "0.0"
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                // Using standard "Bearer" (Uppercase) which PayPhone's IIS server often requires
                'Authorization': `Bearer ${tokenLimpio}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'PayPhone-SDK-Node/1.0' // Added to avoid bot protection rejection
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        const contentType = response.headers.get('content-type') || '';

        if (!response.ok || !contentType.includes('application/json')) {
            // Precise diagnosis for HTML errors (catching common IIS error tags)
            let htmlExtract = "";
            if (contentType.includes('text/html')) {
                const h1 = responseText.match(/<h1>(.*?)<\/h1>/i)?.[1];
                const h2 = responseText.match(/<h2>(.*?)<\/h2>/i)?.[1];
                const desc = responseText.match(/<b> Description: <\/b>(.*?)<br>/i)?.[1];
                htmlExtract = (h1 || h2 || desc || "No identified error tag in HTML").trim();
            }

            console.error('[PayPhone Prepare] V2 Server Error:', {
                status: response.status,
                contentType,
                extract: htmlExtract,
                url
            });

            return NextResponse.json({
                ok: false,
                error: contentType.includes('application/json') ? 'PAYPHONE_UPSTREAM_ERROR' : 'PAYPHONE_NON_JSON',
                upstreamStatus: response.status,
                contentType,
                htmlExtract,
                endpoint: url,
                bodySnippet: responseText.slice(0, 5000)
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
