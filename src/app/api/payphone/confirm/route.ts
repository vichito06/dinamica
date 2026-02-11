
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SaleStatus, TicketStatus } from "@prisma/client";

export const runtime = "nodejs";

function mustEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

export async function POST(req: Request) {
    try {
        const TOKEN = mustEnv("PAYPHONE_TOKEN");
        const body = await req.json();

        const clientTxId = String(body.clientTransactionId ?? body.clientTxId);

        // Idempotency check: If sale already paid, return early
        const existingSale = await prisma.sale.findUnique({
            where: { clientTransactionId: clientTxId }
        });

        if (existingSale && existingSale.status === SaleStatus.PAID) {
            return NextResponse.json({
                status: "OK",
                message: "Sale already confirmed as paid",
                transactionStatus: "Approved",
                statusCode: 3
            });
        }

        // PayPhone requirements: { id, clientTxId }
        const payload = {
            id: Number(body.id),
            clientTxId: clientTxId,
        };

        const APP_URL = process.env.APP_URL || "https://yvossoeee.com";

        const res = await fetch("https://pay.payphonetodoesposible.com/api/button/V2/Confirm", {
            method: "POST",
            headers: {
                Authorization: `bearer ${TOKEN}`,
                "Content-Type": "application/json",
                "Referer": `${APP_URL}/`
            },
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        if (!res.ok) {
            console.error('[PayPhone Confirm] Error:', res.status, text);
            return NextResponse.json(
                { error: "Payphone Confirm failed", status: res.status, detail: text.slice(0, 800) },
                { status: 502 }
            );
        }

        const data = JSON.parse(text); // includes statusCode, transactionStatus, etc.

        // statusCode: 3 approved, 2 canceled.
        if (data.statusCode === 3) {
            await confirmSale(payload.clientTxId, data);
        } else if (data.statusCode === 2) {
            await handleCancellation(payload.clientTxId);
        }

        return NextResponse.json(data);
    } catch (e: any) {
        console.error('[PayPhone Confirm] Exception:', e);
        return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
    }
}

async function confirmSale(clientTxId: string, payphoneData: any) {
    await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findUnique({
            where: { clientTransactionId: clientTxId },
            include: { tickets: true }
        });

        if (!sale) return;
        if (sale.status === SaleStatus.PAID) return;

        await tx.sale.update({
            where: { id: sale.id },
            data: {
                status: SaleStatus.PAID,
                payphonePaymentId: String(payphoneData.transactionId || payphoneData.id),
                payphoneStatusCode: Number(payphoneData.statusCode),
                payphoneAuthorizationCode: String(payphoneData.authorizationCode || ""),
                confirmedAt: new Date(),
            }
        });

        for (const t of sale.tickets) {
            await tx.ticket.update({
                where: { id: t.id },
                data: { status: TicketStatus.SOLD }
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
        if (sale.status === SaleStatus.PAID) return;

        await tx.sale.update({
            where: { id: sale.id },
            data: { status: SaleStatus.CANCELED }
        });

        for (const t of sale.tickets) {
            // Only free up tickets if they are currently HELD by this sale
            if (t.status === TicketStatus.HELD) {
                await tx.ticket.update({
                    where: { id: t.id },
                    data: {
                        status: TicketStatus.AVAILABLE,
                        saleId: null,
                        reservedUntil: null
                    }
                });
            }
        }
    });
}
