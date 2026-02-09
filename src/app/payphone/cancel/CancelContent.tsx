"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function CancelContent() {
    const sp = useSearchParams();

    const message =
        sp.get("message") ??
        sp.get("reason") ??
        sp.get("error") ??
        "El pago fue cancelado.";

    const transactionId =
        sp.get("id") ?? sp.get("transactionId") ?? sp.get("clientTransactionId");

    const id = sp.get("id");

    // Keep the cancellation logic from previous implementation
    useEffect(() => {
        if (id) {
            // Attempt to release updated reservation
            fetch("/api/sales/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ saleId: id })
            }).catch(err => console.error("Error releasing reservation:", err));
        }
    }, [id]);


    return (
        <div className="mx-auto max-w-xl p-6 text-center text-white">
            <h1 className="text-2xl font-bold">Pago cancelado</h1>

            {transactionId && (
                <p className="mt-2 text-sm opacity-80">Transacción: {transactionId}</p>
            )}

            <p className="mt-4">{message}</p>

            <div className="mt-6 flex flex-wrap gap-3 justify-center">
                <Link href="/" className="rounded-md bg-white/10 px-4 py-2 text-white hover:bg-white/20 transition-colors">
                    Volver al inicio
                </Link>

                {/* Using /checkout as it is the known checkout route */}
                <Link href="/checkout" className="rounded-md bg-white text-black px-4 py-2 font-bold hover:scale-105 transition-transform">
                    Intentar de nuevo
                </Link>
            </div>
        </div>
    );
}
