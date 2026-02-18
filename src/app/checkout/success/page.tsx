'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertCircle, ArrowRight, RefreshCw, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

function SuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const saleId = searchParams.get('saleId');

    const [sale, setSale] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('PENDING');
    const [pollCount, setPollCount] = useState(0);
    const [isReconciling, setIsReconciling] = useState(false);
    const maxPolls = 15; // 30 seconds total (2s intervals)
    const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchSale = useCallback(async () => {
        if (!saleId) return;

        try {
            const res = await fetch(`/api/sales/${saleId}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('No pudimos encontrar tu pedido.');

            const data = await res.json();
            setSale(data);
            setStatus(data.status);

            if (data.status === 'PAID') {
                setLoading(false);
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            } else if (data.status === 'ERROR' || data.lastError) {
                setLoading(false);
                // Don't clear interval if it's just a lastError but might still be pending? 
                // Actually, if it has lastError it's probably stuck, but reconcile might fix it.
            }
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
    }, [saleId]);

    const handleReconcile = async () => {
        if (!saleId || isReconciling) return;
        setIsReconciling(true);
        try {
            const res = await fetch('/api/payphone/reconcile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saleId })
            });
            const data = await res.json();
            if (data.ok && data.status === 'APPROVED') {
                await fetchSale();
            } else if (data.error) {
                alert(`Estado: ${data.status || 'No detectado'}. ${data.error}`);
            } else {
                alert(`El pago aún no aparece como aprobado en PayPhone (${data.status || 'PENDING'}).`);
            }
        } catch (e) {
            alert('Error al intentar recuperar el pago. Intente nuevamente en unos segundos.');
        } finally {
            setIsReconciling(false);
        }
    };

    useEffect(() => {
        if (!saleId) {
            setLoading(false);
            setError('ID de venta no proporcionado.');
            return;
        }

        fetchSale();

        // [SEV-PAYPHONE] Auto-reconcile once on mount to handle mobile redirect failures immediately
        handleReconcile();

        // Polling if PENDING
        pollTimerRef.current = setInterval(() => {
            setPollCount(prev => {
                if (prev >= maxPolls) {
                    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                    setLoading(false);
                    return prev;
                }
                fetchSale();
                return prev + 1;
            });
        }, 2000);

        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, [saleId, fetchSale]);

    if (loading && !sale) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                <p className="text-white/70">Cargando información de tu compra...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-10">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Ops! Algo salió mal</h2>
                <p className="text-white/60 mb-6">{error}</p>
                <Link href="/checkout" className="px-6 py-3 bg-white text-black font-bold rounded-xl">
                    Volver al Checkout
                </Link>
            </div>
        );
    }

    const isPaid = status === 'PAID';
    const isPending = status === 'PENDING' && pollCount < maxPolls;
    const isTimeout = status === 'PENDING' && pollCount >= maxPolls;
    const isError = status === 'ERROR' || (sale?.lastError && !isPaid);

    const ticketNumbers = isPaid ? (sale.tickets || []).map((t: any) => t.number.toString().padStart(4, '0')) : sale?.requestedNumbers || [];

    return (
        <div className="max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-strong p-8 rounded-2xl text-center mb-8 border border-white/10"
            >
                {isPaid ? (
                    <>
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                            <Check className="w-10 h-10 text-green-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">¡Compra Confirmada!</h2>
                        <p className="text-white/60 mb-8">Tus números han sido asignados exitosamente.</p>
                    </>
                ) : isError ? (
                    <>
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Estado Incierto</h2>
                        <p className="text-red-400/80 mb-4 px-4 py-2 bg-red-500/10 rounded-lg text-sm">
                            {sale?.lastError || "Estamos teniendo problemas para confirmar el pago automáticamente."}
                        </p>
                        <p className="text-white/50 text-xs mb-8">
                            Si el dinero fue descontado, no te preocupes, tus números están bloqueados para ti.
                            Contacta a soporte con el ID: <span className="font-mono text-white/80">{sale.id}</span>
                        </p>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <RefreshCw className="w-10 h-10 text-orange-400 animate-spin" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Procesando Pago...</h2>
                        <p className="text-white/60 mb-8">Estamos esperando la confirmación de PayPhone. Esto puede tomar unos segundos.</p>
                    </>
                )}

                {/* Tickets Grid */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Image src="/logo.png" alt="watermark" width={80} height={80} />
                    </div>
                    <h3 className="text-white/40 font-bold mb-4 uppercase tracking-[0.2em] text-[10px]">Números Adquiridos</h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {ticketNumbers.map((num: string) => (
                            <div key={num} className="bg-white/10 border border-white/10 py-3 rounded-xl text-white font-mono font-bold text-xl shadow-inner">
                                {num}
                            </div>
                        ))}
                    </div>

                    {!isPaid && (
                        <div className="mt-4 text-[10px] text-orange-400/70 italic">
                            * Números en proceso de confirmación
                        </div>
                    )}
                </div>

                {/* Support and Actions */}
                <div className="flex flex-col gap-4">
                    {/* [SEV-PAYPHONE] Reconciliation Button */}
                    {(isPending || isError || isTimeout) && !isPaid && (
                        <button
                            onClick={handleReconcile}
                            disabled={isReconciling}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isReconciling ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    Verificando en PayPhone...
                                </>
                            ) : (
                                <>
                                    <Check className="w-5 h-5" />
                                    Ya pagué / Recuperar mis números
                                </>
                            )}
                        </button>
                    )}

                    {isPaid && (
                        <Link
                            href="/"
                            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                        >
                            Comprar Más Números
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    )}

                    <a
                        href={`https://wa.me/593984180860?text=Hola,%20tengo%20un%20inconveniente%20con%20mi%20compra%20${sale?.id}`}
                        target="_blank"
                        className="w-full py-4 bg-green-600/10 border border-green-600/30 text-green-400 font-bold rounded-xl hover:bg-green-600/20 transition-all flex items-center justify-center gap-2"
                    >
                        Soporte WhatsApp
                        <ExternalLink className="w-4 h-4" />
                    </a>

                    <p className="text-[10px] text-white/20 mt-4">
                        Orden ID: {sale?.id} | {new Date(sale?.createdAt).toLocaleString()}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

export default function CheckoutSuccessPage() {
    return (
        <main className="min-h-screen textured-bg grid-pattern p-4 pt-12">
            <Suspense fallback={<div className="flex justify-center pt-20"><Loader2 className="w-12 h-12 text-white animate-spin" /></div>}>
                <SuccessContent />
            </Suspense>
        </main>
    );
}
