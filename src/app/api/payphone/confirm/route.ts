export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.PAYPHONE_BASE_URL || "https://pay.payphonetodoesposible.com";

export async function POST(req: Request) {
    try {
        const { id, clientTxId } = await req.json();
        if (!id || !clientTxId) return Response.json({ error: "id y clientTxId requeridos" }, { status: 400 });

        console.log(`[Payphone Confirm] Received confirm for id=${id}, clientTxId=${clientTxId}`);

        const token = process.env.PAYPHONE_TOKEN;
        if (!token) {
            console.error("[Payphone Confirm] Missing env vars");
            return Response.json({ error: "Config error" }, { status: 500 });
        }

        const r = await fetch(`${BASE_URL}/api/button/V2/Confirm`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id, clientTxId }),
        });

        const data = await r.json();
        if (!r.ok) {
            console.error("[Payphone Confirm] API Error:", data);
            return Response.json({ error: "Confirm falló", details: data }, { status: 400 });
        }

        const status = data?.transactionStatus || data?.status || "Unknown";
        console.log(`[Payphone Confirm] Payphone status for ${clientTxId}: ${status}`);

        // Idempotencia + consistencia DB
        const transactionResult = await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.findUnique({
                where: { payphoneClientTxId: clientTxId },
            });

            if (!sale) {
                console.error(`[Payphone Confirm] Sale not found for clientTxId ${clientTxId}`);
                return null;
            }

            console.log(`[Payphone Confirm] Found Sale ${sale.id} with status ${sale.status}`);

            if (status === "Approved") {
                if (sale.status === "PAID") {
                    console.log(`[Payphone Confirm] Sale ${sale.id} already PAID. Skipping.`);
                    return sale;
                }

                console.log(`[Payphone Confirm] Marking Sale ${sale.id} as PAID`);
                await tx.sale.update({ where: { id: sale.id }, data: { status: "PAID" } });

                // Assign tickets to this sale (ownership) and mark SOLD
                await tx.ticket.updateMany({
                    where: { reservedBySaleId: sale.id },
                    data: {
                        status: "SOLD",
                        saleId: sale.id, // Set ownership
                        reservedUntil: null,
                        reservedBySaleId: null
                    },
                });
                return sale;
            } else {
                // Cancelled, Rejected, etc.
                if (sale.status !== "PENDING") {
                    console.log(`[Payphone Confirm] Sale ${sale.id} is ${sale.status} (not PENDING). Skipping cancellation logic.`);
                    return sale;
                }

                console.log(`[Payphone Confirm] Marking Sale ${sale.id} as CANCELED/FAILED`);
                await tx.sale.update({
                    where: { id: sale.id },
                    data: { status: status === "Canceled" ? "CANCELED" : "FAILED" }
                });

                console.log(`[Payphone Confirm] Releasing tickets for Sale ${sale.id}`);
                await tx.ticket.updateMany({
                    where: { reservedBySaleId: sale.id, status: "RESERVED" },
                    data: { status: "AVAILABLE", reservedUntil: null, reservedBySaleId: null },
                });
                return sale;
            }
        });

        let soldTickets: string[] = [];

        if (status === "Approved" && transactionResult) {
            const tickets = await prisma.ticket.findMany({
                where: { saleId: transactionResult.id },
                select: { number: true }
            });
            soldTickets = tickets.map(t => t.number);
        }

        return Response.json({ status, raw: data, tickets: soldTickets });
    } catch (error) {
        console.error("[Payphone Confirm] Internal Error:", error);
        return Response.json({ error: "Internal Error" }, { status: 500 });
    }
}
