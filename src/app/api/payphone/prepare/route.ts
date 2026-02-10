
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

        // Prepare PayPhone request
        const payPhoneToken = process.env.PAYPHONE_TOKEN;
        const storeId = process.env.PAYPHONE_STORE_ID;
        if (!payPhoneToken || !storeId) {
            console.error('Missing PayPhone configuration (TOKEN/STORE_ID)');
            return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
        }

        const baseUrl = process.env.PAYPHONE_BASE_URL || 'https://pay.payphonetodoesposible.com';
        const endpoint = '/api/button/Prepare';

        const payload = {
            amount: sale.amountCents,
            amountWithoutTax: sale.amountCents,
            amountWithTax: 0,
            tax: 0,
            service: 0,
            tip: 0,
            currency: "USD",
            reference: `Venta Dinamica #${sale.id.slice(-6)}`,
            clientTransactionId: sale.clientTransactionId,
            storeId: storeId,
            responseUrl: process.env.PAYPHONE_RESPONSE_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'https://yvossoeee.com'}/payphone/return`,
            cancellationUrl: process.env.PAYPHONE_CANCEL_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'https://yvossoeee.com'}/payphone/cancel`,
            timeZone: -5,
            // Optional fields
            email: sale.customer.email,
            phoneNumber: sale.customer.phone,
            documentId: sale.customer.idNumber,
        };

        console.log('[PayPhone Prepare] Payload:', JSON.stringify(payload));

        // Format Authorization Header
        const authHeader = payPhoneToken.startsWith('Bearer ') ? payPhoneToken : `Bearer ${payPhoneToken}`;

        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        const contentType = response.headers.get('content-type') || '';

        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error('[PayPhone Prepare] Non-JSON response:', responseText.slice(0, 500));
            return NextResponse.json({
                error: 'PAYPHONE_NON_JSON',
                status: response.status,
                contentType,
                bodySnippet: responseText.slice(0, 500)
            }, { status: 502 });
        }

        if (!response.ok) {
            console.error('[PayPhone Prepare] Error:', response.status, responseData);
            return NextResponse.json({ error: 'Payment provider error', details: responseData }, { status: 502 });
        }

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
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
