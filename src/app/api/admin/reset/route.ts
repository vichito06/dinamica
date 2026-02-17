import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
    try {
        // 1. Resetear todos los tickets a disponibles
        await prisma.ticket.updateMany({
            data: {
                status: 'AVAILABLE',
                reservedUntil: null,
                saleId: null,
                sessionId: null,
            }
        });

        // 2. Opcionalmente podríamos limpiar ventas confirmadas si se desea un reset TOTAL
        // Pero por ahora solo liberamos los números para que se puedan comprar de nuevo,
        // manteniendo el historial de ventas si el usuario no especifica lo contrario.

        console.log("[ADMIN_RESET] Rifa restablecida exitosamente");

        return NextResponse.json({
            success: true,
            message: "Todos los tickets han sido restablecidos y están disponibles."
        });

    } catch (error) {
        console.error("[RESET_ERROR]", error);
        return NextResponse.json(
            { success: false, error: "Error al restablecer la rifa" },
            { status: 500 }
        );
    }
}
