
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, clientTransactionId } = body;

        if (!id || !clientTransactionId) {
            return NextResponse.json({ error: 'Missing id or clientTransactionId' }, { status: 400 });
        }

        const payPhoneToken = process.env.PAYPHONE_TOKEN;
        if (!payPhoneToken) {
            console.error('Missing PAYPHONE_TOKEN env var');
            return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
        }

        const response = await fetch('https://pay.payphonetodoesposible.com/api/button/V2/Confirm', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${payPhoneToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: id,
                clientTxId: clientTransactionId
            })
        });

        const responseText = await response.text();
        let responseData;

        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error('[PayPhone Confirm] Non-JSON response:', responseText);
            return NextResponse.json({ error: 'Upstream provider error' }, { status: 502 });
        }

        if (!response.ok) {
            console.error('[PayPhone Confirm] Error:', response.status, responseData);
            // Handle cancellation or error
            await handleCancellation(clientTransactionId);
            return NextResponse.json({ error: 'Payment failed', details: responseData }, { status: 400 });
        }

        // Check transactionStatus
        if (responseData.transactionStatus === 'Approved') {
            await confirmSale(clientTransactionId, responseData);
            return NextResponse.json({ status: 'Approved', data: responseData });
        } else {
            await handleCancellation(clientTransactionId);
            return NextResponse.json({ status: responseData.transactionStatus, data: responseData });
        }

    } catch (error: any) {
        console.error('[PayPhone Confirm] Exception:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

async function confirmSale(clientTxId: string, payphoneData: any) {
    // Atomic update
    await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findUnique({
            where: { clientTransactionId: clientTxId },
            include: { tickets: true }
        });

        if (!sale) return;

        if (sale.status === 'PAID') return; // Already paid

        // Update Sale
        await tx.sale.update({
            where: { id: sale.id },
            data: {
                status: 'PAID',
                payphonePaymentId: String(payphoneData.transactionId || payphoneData.id), // PayPhone returns id or transactionId? Verify docs or response
                confirmedAt: new Date(),
            }
        });

        // Update Tickets
        for (const t of sale.tickets) {
            await tx.ticket.update({
                where: { id: t.id },
                data: { status: 'SOLD' }
            });
        }
    });
}

async function handleCancellation(clientTxId: string) {
    await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findUnique({
            where: { clientTransactionId: clientTxId },
            include: { tickets: true }
        });

        if (!sale) return;
        if (sale.status === 'PAID') return; // Don't cancel if already paid (race condition)

        // Update Sale
        await tx.sale.update({
            where: { id: sale.id },
            data: { status: 'CANCELED' }
        });

        // Release Tickets
        for (const t of sale.tickets) {
            await tx.ticket.update({
                where: { id: t.id },
                data: {
                    status: 'AVAILABLE',
                    saleId: null,
                    reservedUntil: null
                }
            });
        }
    });
}
