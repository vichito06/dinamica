"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import Link from "next/link";

function ReturnContent() {
    const sp = useSearchParams();
    const router = useRouter();
    const [msg, setMsg] = useState("Procesando pago...");
    const [status, setStatus] = useState<"loading" | "approved" | "error">("loading");

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
                    setMsg("¡Pago aprobado! Tus tickets han sido confirmados.");
                    setStatus("approved");
                    // Clear session storage just in case
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
            <div className="glass-strong p-8 rounded-2xl max-w-md w-full text-center">
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
                        status === "approved" ? "¡Compra Exitosa!" : "Algo salió mal"}
                </h2>

                <p className="text-white/70 mb-8">
                    {msg}
                </p>

                <Link
                    href="/"
                    className="inline-block px-8 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform"
                >
                    Volver al Inicio
                </Link>
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
