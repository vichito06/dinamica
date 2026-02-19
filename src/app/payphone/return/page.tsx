'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, X, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';


function ReturnContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const [ticketNumbers, setTicketNumbers] = useState<string[]>([]);
    const [saleId, setSaleId] = useState<string | null>(null);
    const [redirectTimer, setRedirectTimer] = useState(10);

    // Safe storage wrapper
    const safeSessionGet = (key: string) => {
        try { return sessionStorage.getItem(key); } catch (e) { return null; }
    };
    const safeSessionSet = (key: string, val: string) => {
        try { sessionStorage.setItem(key, val); } catch (e) { }
    };

    useEffect(() => {
        const id = searchParams.get('id');
        const clientTxId = searchParams.get('clientTransactionId');

        // [SOLUCIÓN] No fallar si id es '0' o falta, siempre que tengamos clientTxId
        const effectiveId = (id && id !== '0') ? id : null;

        if (!effectiveId && !clientTxId) {
            console.error("[RETURN] Missing identifiers in searchParams.");
            setStatus('error');
            setMessage('No se encontró el ID de la transacción. Intenta refrescar.');
            return;
        }

        const confirmSaleId = clientTxId || effectiveId; // Priorizar TX interno
        setSaleId(confirmSaleId);

        console.log(`[RETURN] Starting confirmation for id=${id} | clientTxId=${clientTxId} | using=${confirmSaleId}`);

        // [SEV-MOBILE] Hard Redirect Timeout (10s)
        const timeout = setTimeout(() => {
            console.log(`[RETURN] Timeout reached for ${confirmSaleId}. Redirecting to success page.`);
            router.push(`/checkout/success?saleId=${clientTxId || id}&id=${id}`);
        }, 10000);

        const confirmPayment = async () => {
            const currentId = confirmSaleId;
            if (!currentId) return;

            const key = `confirm_done_${currentId}`;
            if (safeSessionGet(key)) {
                console.log("[RETURN] Already confirmed in this session:", currentId);
                router.push(`/checkout/success?saleId=${clientTxId || id}&id=${id}`);
                return;
            }

            try {
                const response = await fetch('/api/payphone/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: effectiveId,
                        saleId: currentId,
                        clientTransactionId: clientTxId
                    }),
                    cache: 'no-store'
                });

                const data = await response.json();
                console.log(`[RETURN] Confirm response status=${response.status} for ${id}:`, data);

                if (response.ok && (data.statusCode === 3 || data.ok)) {
                    safeSessionSet(key, "1");
                    setStatus('success');
                    // Instant redirect to success page on confirmation
                    router.push(`/checkout/success?saleId=${clientTxId || id}&id=${id}`);
                } else if (data.statusCode === 2) {
                    setStatus('error');
                    setMessage('El pago fue rechazado o cancelado.');
                    clearTimeout(timeout);
                } else {
                    console.warn(`[RETURN] Unexpected status for ${id}. Will allow timeout redirect.`);
                }
            } catch (error) {
                console.error(`[RETURN] Fetch error for ${id}:`, error);
                // We DON'T set status to error here to allow the timeout redirect to work
                // in case it was just a transient connection issue but the payment went through.
            }
        };

        confirmPayment();
        return () => clearTimeout(timeout);
    }, [searchParams, router]);

    // Countdown for redirect
    useEffect(() => {
        if (status === 'loading' && redirectTimer > 0) {
            const t = setTimeout(() => setRedirectTimer(prev => prev - 1), 1000);
            return () => clearTimeout(t);
        }
    }, [redirectTimer, status]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-strong p-8 md:p-12 rounded-2xl max-w-2xl w-full text-center border border-white/10 shadow-2xl"
        >
            {status === 'loading' && (
                <div className="flex flex-col items-center">
                    <div className="relative mb-8">
                        <Loader2 className="w-20 h-20 text-blue-500 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-white text-xs">
                            {redirectTimer}s
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Finalizando Compra</h2>
                    <p className="text-white/60 mb-8 max-w-xs mx-auto">
                        Estamos verificando tu pago con PayPhone. No cierres esta ventana.
                    </p>

                    {saleId && (
                        <button
                            onClick={() => router.push(`/checkout/success?saleId=${saleId}`)}
                            className="w-full py-4 bg-white/10 border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2 group"
                        >
                            Ver mis números ahora
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    )}
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                        <X className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Transferencia Incompleta</h2>
                    <p className="text-white/70 mb-8">
                        {message || "No pudimos confirmar el estado de tu pago."}
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                        <button
                            onClick={() => router.push('/checkout')}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold rounded-xl"
                        >
                            Volver al Checkout
                        </button>
                        <Link href="/" className="text-white/40 text-sm hover:text-white transition-colors">
                            Volver al Inicio
                        </Link>
                    </div>
                </div>
            )}

            {status === 'success' && (
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                        <Check className="w-10 h-10 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">¡Confirmado!</h2>
                    <p className="text-white/60 mb-6">Redirigiéndote a tus números...</p>
                    <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                </div>
            )}
        </motion.div>
    );
}

export default function PayPhoneReturnPage() {
    return (
        <div className="min-h-screen textured-bg grid-pattern flex items-center justify-center p-4">
            <Suspense fallback={<div className="text-white">Cargando...</div>}>
                <ReturnContent />
            </Suspense>
        </div>
    );
}
