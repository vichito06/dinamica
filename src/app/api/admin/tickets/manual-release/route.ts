import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SaleStatus, TicketStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { raffleId, number, reason, force } = body as {
            raffleId?: string;
            number?: number;
            reason?: string;
            force?: boolean;
        };

        if (!raffleId || !number) {
            return NextResponse.json({ error: "raffleId and number required" }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const ticket = await tx.ticket.findUnique({
                where: { raffleId_number: { raffleId, number: Number(number) } },
                include: { sale: true },
            });

            if (!ticket) return { ok: false, code: "NOT_FOUND" as const };

            // Solo tiene sentido liberar si estaba RESERVED o SOLD
            if (ticket.status === TicketStatus.AVAILABLE) return { ok: true, already: true };

            // Guard de seguridad: si la venta está PAID, permitir SOLO si force=true
            if (ticket.sale?.status === SaleStatus.PAID && !force) {
                return {
                    ok: false,
                    code: "SALE_IS_PAID" as const,
                    message: "La venta está PAGADA. Usa 'Forzar' solo si PayPhone la reversó."
                };
            }

            // Libera el ticket
            await tx.ticket.update({
                where: { id: ticket.id },
                data: {
                    status: TicketStatus.AVAILABLE,
                    saleId: null,
                    soldAt: null,
                    reservedUntil: null,
                    sessionId: null,
                },
            });

            // Si había una venta asociada, la marcamos como CANCELED (o REVERSADA)
            if (ticket.saleId) {
                await tx.sale.update({
                    where: { id: ticket.saleId },
                    data: {
                        status: SaleStatus.CANCELED,
                        lastError: `MANUAL_RELEASE${force ? "_FORCED" : ""}: ${reason || "No reason provided"}`,
                        lastErrorAt: new Date(),
                    },
                });
            }

            return { ok: true };
        });

        if (!result.ok && result.code === "SALE_IS_PAID") {
            return NextResponse.json(result, { status: 409 });
        }

        if (!result.ok && result.code === "NOT_FOUND") {
            return NextResponse.json(result, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[Admin Manual Release] Error:", error);
        return NextResponse.json({ error: "Internal Error", message: error.message }, { status: 500 });
    }
}
