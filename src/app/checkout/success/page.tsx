'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, Loader2, AlertCircle, ArrowRight, RefreshCw, ExternalLink, Mail } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_URL;

type PageState =
    | { kind: "loading" }
    | { kind: "success"; numbers: string[]; emailed: boolean; sale: any }
    | { kind: "error"; message: string; canRecover: boolean; saleId?: string };

function SuccessContent() {
    const searchParams = useSearchParams();
    const saleId = searchParams.get('saleId');

    // UseRef to ensure only one polling process starts
    const pollingStarted = useRef(false);
    const [state, setState] = useState<PageState>({ kind: "loading" });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const onRecover = async () => {
        if (!saleId) return;
        try {
            // Using the admin resend-email endpoint as it's the current "recover" mechanism
            const res = await fetch(`/api/admin/sales/${saleId}/resend-email`, { method: "POST" });
            const data = await res.json();
            if (data.ok) {
                alert("¡Listo! Si el pago está confirmado, el correo se reenvió con tus números.");
            } else {
                alert(`Error: ${data.detail || data.error || "No se pudo recuperar"}`);
            }
        } catch (e) {
            alert("Error de red al intentar recuperar.");
        }
    };

    useEffect(() => {
        if (!saleId || saleId === '0') {
            if (saleId === '0') {
                console.warn("[SUCCESS] Invalid saleId='0' detected. Skipping confirmation.");
            }
            setState({ kind: "error", message: "Falta identificador de venta (saleId) o es inválido.", canRecover: false });
            return;
        }

        if (pollingStarted.current) return;
        pollingStarted.current = true;

        let isCancelled = false;

        const confirmWithBackoff = async () => {
            // Aumentamos los intentos a 8 para dar más tiempo (aprox 20-30s total)
            const delays = [0, 1000, 2000, 3000, 4000, 5000, 5000, 5000];

            for (let i = 0; i < delays.length; i++) {
                if (delays[i] > 0) await sleep(delays[i]);
                if (isCancelled) return;

                // Si por alguna razón el saleId es '0', re-intentamos leerlo de la URL por si React tardó
                let currentId = saleId;
                if (currentId === '0' || !currentId) {
                    const params = new URLSearchParams(window.location.search);
                    currentId = params.get('saleId');
                }

                if (!currentId || currentId === '0') {
                    // Si sigue siendo 0 después de un par de intentos, fallamos
                    if (i > 2) break;
                    continue;
                }

                try {
                    const res = await fetch("/api/payphone/confirm", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ saleId: currentId }),
                    });

                    // Si es 202 (Accepted/Pending), el backend dice "espera un poco"
                    // Continuamos el loop sin cambiar el estado.
                    if (res.status === 202) {
                        console.log("[SUCCESS] Confirmation pending (202), retrying...");
                        continue;
                    }

                    const data = await res.json();

                    if (res.ok) {
                        const rawNumbers = Array.isArray(data?.numbers) ? data.numbers : [];
                        const numbers = rawNumbers.map((n: any) => String(n).padStart(4, '0'));

                        if (!isCancelled) {
                            setState({
                                kind: "success",
                                numbers,
                                emailed: !!data?.emailed,
                                sale: { id: currentId, createdAt: new Date().toISOString() }
                            });
                        }
                        return;
                    }

                    // 409 usually means tickets not available - definitely show error
                    if (res.status === 409) {
                        if (!isCancelled) {
                            setState({
                                kind: "error",
                                message: data?.error ?? "No se pudieron asignar tus números automáticamente.",
                                canRecover: true,
                                saleId: currentId
                            });
                        }
                        return;
                    }
                } catch (err) {
                    console.error("[POLLING_ERROR]", err);
                }
            }

            // If we're here, all attempts failed or timed out
            if (!isCancelled) {
                setState({
                    kind: "error",
                    message: "Estamos teniendo demoras para confirmar tu pago con PayPhone.",
                    canRecover: true,
                    saleId: saleId
                });
            }
        };

        confirmWithBackoff();

        return () => {
            isCancelled = true;
        };
    }, [saleId]);

    const isPaid = state.kind === 'success';
    const isError = state.kind === 'error';

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
                        <h2 className="text-3xl font-bold text-white mb-2">¡Pago Confirmado!</h2>
                        <p className="text-green-400/80 text-sm mb-8 px-4 py-2 bg-green-500/10 rounded-lg inline-block">
                            Tus números han sido asignados exitosamente.
                        </p>
                    </>
                ) : isError ? (
                    <>
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Estado Incierto</h2>
                        <p className="text-red-400/80 mb-4 px-4 py-2 bg-red-500/10 rounded-lg text-sm">
                            {state.message}
                        </p>
                        <p className="text-white/50 text-xs mb-8">
                            Si el dinero fue descontado, no te preocupes, tus números están bloqueados para ti.
                            Haga clic en el botón de abajo para intentar recuperar.
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
                {(isPaid || (isError && state.saleId)) && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                            <Image src="/logo.png" alt="watermark" width={80} height={80} />
                        </div>
                        <h3 className="text-white/40 font-bold mb-4 uppercase tracking-[0.2em] text-[10px]">
                            {isPaid ? "Números Adquiridos" : "Resumen de Orden"}
                        </h3>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {isPaid ? state.numbers.map((num: string) => (
                                <div key={num} className="bg-white/10 border border-white/10 py-3 rounded-xl text-white font-mono font-bold text-xl shadow-inner">
                                    {num}
                                </div>
                            )) : (
                                <div className="col-span-full py-4 text-white/30 italic text-sm">
                                    Los números se mostrarán una vez recuperados.
                                </div>
                            )}
                        </div>

                        {isPaid && (
                            <div className="mt-4 text-[10px] text-green-400/70 italic flex items-center justify-center gap-1">
                                <Mail className="w-3 h-3" />
                                {state.emailed ? "Comprobante enviado a tu correo" : "Enviando comprobante..."}
                            </div>
                        )}
                    </div>
                )}

                {/* Support and Actions */}
                <div className="flex flex-col gap-4">
                    {isError && state.canRecover && (
                        <button
                            onClick={onRecover}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/50 transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Ya pagué / Recuperar mis números
                        </button>
                    )}

                    {isPaid && (
                        <>
                            <button
                                onClick={onRecover}
                                className="w-full py-4 bg-white/10 border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Mail className="w-5 h-5" />
                                Reenviar a mi correo
                            </button>

                            <Link
                                href="/"
                                className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                            >
                                Comprar Más Números
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </>
                    )}

                    {SUPPORT_URL && (
                        <a
                            href={SUPPORT_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-4 bg-green-600/10 border border-green-600/30 text-green-400 font-bold rounded-xl hover:bg-green-600/20 transition-all flex items-center justify-center gap-2"
                        >
                            Soporte WhatsApp
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    )}

                    <p className="text-[10px] text-white/20 mt-4">
                        Orden ID: {saleId}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

export default function CheckoutSuccessPage() {
    return (
        <main className="min-h-[100dvh] textured-bg grid-pattern p-4 pt-12 overflow-y-auto">
            <Suspense fallback={<div className="flex justify-center pt-20"><Loader2 className="w-12 h-12 text-white animate-spin" /></div>}>
                <SuccessContent />
            </Suspense>
        </main>
    );
}
