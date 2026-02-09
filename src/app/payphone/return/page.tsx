"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import Link from "next/link";

const [tickets, setTickets] = useState<string[]>([]);

useEffect(() => {
    const id = sp.get("id");
    const clientTxId = sp.get("clientTransactionId");

    if (!id || !clientTxId) {
        setMsg("No llegaron datos del pago. Si cancelaste, es normal.");
        setStatus("error");
        return;
    }

    (async () => {
        try {
            const r = await fetch("/api/payphone/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, clientTxId }),
            });

            const data = await r.json();

            if (r.ok && (data.status === "Approved" || data.transactionStatus === "Approved")) {
                setMsg("¡Pago confirmado! Tus tickets están listos.");
                if (data.tickets && Array.isArray(data.tickets)) {
                    setTickets(data.tickets);
                }
                setStatus("approved");
                // Clear session storage
                sessionStorage.removeItem('selectedNumbers');
            } else {
                setMsg("El pago no fue aprobado o fue cancelado. Por favor intenta nuevamente.");
                setStatus("error");
                console.error("Payment not approved:", data);
            }
        } catch (err) {
            console.error("Error confirming payment:", err);
            setMsg("Hubo un error al verificar el pago.");
            setStatus("error");
        }
    })();
}, [sp]);

return (
    <div className="min-h-screen textured-bg grid-pattern flex items-center justify-center p-4">
        <div className="glass-strong p-8 rounded-2xl max-w-lg w-full text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${status === "loading" ? "bg-white/10 animate-pulse" :
                status === "approved" ? "bg-green-600" : "bg-red-600"
                }`}>
                {status === "loading" ? (
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                ) : status === "approved" ? (
                    <Check className="w-10 h-10 text-white" />
                ) : (
                    <X className="w-10 h-10 text-white" />
                )}
            </div>

            <h2 className="text-2xl font-bold text-white mb-4">
                {status === "loading" ? "Verificando..." :
                    status === "approved" ? "¡Pago Confirmado!" : "Algo salió mal"}
            </h2>

            <p className="text-white/70 mb-6">
                {msg}
            </p>

            {status === "approved" && tickets.length > 0 && (
                <div className="mb-8 overflow-hidden rounded-xl border border-white/10">
                    <div className="bg-white/5 p-3 text-sm font-bold text-white uppercase tracking-wider">
                        Mis Tickets ({tickets.length})
                    </div>
                    <div className="bg-black/30 p-4 max-h-48 overflow-y-auto custom-scrollbar grid grid-cols-3 gap-2">
                        {tickets.map(t => (
                            <div key={t} className="bg-white/10 rounded p-2 font-mono font-bold text-white text-sm">
                                {t}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {status === "approved" && (
                    <Link
                        href="/"
                        className="inline-block px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:scale-105 transition-transform"
                    >
                        Ver mis tickets / Volver
                    </Link>
                )}

                {status !== "approved" && status !== "loading" && (
                    <Link
                        href="/checkout"
                        className="inline-block px-8 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform"
                    >
                        Intentar de nuevo
                    </Link>
                )}

                {status === "approved" && (
                    <div className="text-xs text-white/40 mt-2">
                        Hemos enviado los detalles a tu correo.
                    </div>
                )}
            </div>
        </div>
    </div>
);
}

export default function PayphoneReturnPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Cargando...</div>}>
            <ReturnContent />
        </Suspense>
    );
}
