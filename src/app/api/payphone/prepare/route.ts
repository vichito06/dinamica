
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
        if (!payPhoneToken) {
            console.error('Missing PAYPHONE_TOKEN env var');
            return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
        }

        const payload = {
            amount: sale.amountCents,
            amountWithoutTax: sale.amountCents,
            currency: sale.currency, // e.g. "USD"
            clientTransactionId: sale.clientTransactionId,
            responseUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payphone/return`,
            cancellationUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payphone/cancel`,
            // Optional fields
            details: `Compra de tickets: ${sale.tickets.map(t => t.number).join(', ')}`,
            email: sale.customer.email,
            phoneNumber: sale.customer.phone,
            documentId: sale.customer.idNumber,
        };

        console.log('[PayPhone Prepare] Payload:', JSON.stringify(payload));

        const response = await fetch('https://pay.payphonetodoesposible.com/api/button/Prepare', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${payPhoneToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        let responseData;

        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error('[PayPhone Prepare] Non-JSON response:', responseText);
            return NextResponse.json({ error: 'Upstream provider error (Non-JSON)' }, { status: 502 });
        }

        if (!response.ok) {
            console.error('[PayPhone Prepare] Error:', response.status, responseData);
            return NextResponse.json({ error: 'Payment provider error', details: responseData }, { status: 502 });
        }

        // According to PayPhone docs, response contains paymentId and payWithCard url
        // Look for paymentId to store if needed
        if (responseData.paymentId) {
            await prisma.sale.update({
                where: { id: sale.id },
                data: { payphonePaymentId: String(responseData.paymentId) }
            });
        }

        return NextResponse.json({
            redirectUrl: responseData.payWithCard, // usage preference as per requirement
            paymentId: responseData.paymentId
        });

    } catch (error: any) {
        console.error('[PayPhone Prepare] Exception:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
