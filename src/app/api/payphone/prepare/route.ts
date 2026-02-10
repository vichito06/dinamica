
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

        // Radical token cleaning
        const tokenRaw = process.env.PAYPHONE_TOKEN ?? "";
        const token = tokenRaw.replace(/[\r\n\t\s]+/g, "");

        const storeId = (process.env.PAYPHONE_STORE_ID ?? "").trim();
        const baseUrl = (process.env.PAYPHONE_BASE_URL ?? "https://pay.payphonetodoesposible.com")
            .trim()
            .replace(/\/+$/, "");

        const responseUrl = (process.env.PAYPHONE_RESPONSE_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'https://yvossoeee.com'}/payphone/return`).trim();
        const cancellationUrl = (process.env.PAYPHONE_CANCEL_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'https://yvossoeee.com'}/payphone/cancel`).trim();

        if (!token || !storeId || !responseUrl) {
            return NextResponse.json({ error: 'Configuración de PayPhone incompleta' }, { status: 500 });
        }

        const url = `${baseUrl}/api/button/Prepare`;

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

        // Minimalist payload
        const payload = {
            amount,
            amountWithoutTax,
            amountWithTax,
            tax,
            service,
            tip,
            clientTransactionId: `YVOSS-${Date.now()}-${sale.id.slice(-4)}`,
            reference: "Venta Dinamica",
            storeId,
            currency: "USD",
            responseUrl,
            cancellationUrl: cancellationUrl || undefined,
            timeZone: -5
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `bearer ${token}`, // Forced lowercase 'bearer'
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        const contentType = response.headers.get('content-type') || '';

        if (!response.ok || !contentType.includes('application/json')) {
            // Enhanced diagnosis for HTML errors
            let htmlExtract = "";
            if (contentType.includes('text/html')) {
                const h1 = responseText.match(/<h1>(.*?)<\/h1>/i)?.[1];
                const h2 = responseText.match(/<h2>(.*?)<\/h2>/i)?.[1];
                const pre = responseText.match(/<pre>([\s\S]*?)<\/pre>/i)?.[1];
                htmlExtract = (h1 || h2 || pre || "No clear error tag found").trim();
            }

            console.error('[PayPhone Prepare] Upstream Error:', {
                status: response.status,
                contentType,
                extract: htmlExtract,
                snippet: responseText.slice(0, 500)
            });

            return NextResponse.json({
                error: contentType.includes('application/json') ? 'PAYPHONE_UPSTREAM_ERROR' : 'PAYPHONE_NON_JSON',
                status: response.status,
                contentType,
                htmlExtract,
                endpoint: url,
                bodySnippet: responseText.slice(0, 5000) // Increased snippet
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
