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
    const [emailSent, setEmailSent] = useState(false);

    useEffect(() => {
        const id = searchParams.get('id');
        const clientTxId = searchParams.get('clientTransactionId');

        if (!id || !clientTxId) {
            setStatus('error');
            setMessage('Parámetros inválidos en el retorno de pago.');
            return;
        }

        const confirmPayment = async () => {
            try {
                const response = await fetch('/api/payphone/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, clientTransactionId: clientTxId })
                });

                const data = await response.json();

                // 2) guarda para debug 
                localStorage.setItem("last_payphone_confirm", JSON.stringify(data));

                // PayPhone statusCode: 3 approved, 2 canceled.
                if (response.ok && data.statusCode === 3) {
                    setStatus('success');
                    setTicketNumbers(data.ticketNumbers || []);
                    setEmailSent(data.emailSent || false);

                    // Clear checkout session
                    sessionStorage.removeItem('selectedNumbers');
                    localStorage.removeItem('yvossoeee_selectedNumbers');
                    localStorage.removeItem('yvossoeee_sessionId');
                } else if (data.statusCode === 2) {
                    setStatus('error');
                    setMessage('El pago fue cancelado por el usuario.');
                } else {
                    setStatus('error');
                    setMessage(data.error || 'El pago no pudo ser verificado o no fue aprobado.');
                }
            } catch (error) {
                console.error('Confirmation error:', error);
                setStatus('error');
                setMessage('Error de conexión al confirmar el pago.');
            }
        };

        confirmPayment();
    }, [searchParams, router]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-strong p-8 md:p-12 rounded-2xl max-w-2xl w-full text-center"
        >
            {status === 'loading' && (
                <div className="flex flex-col items-center">
                    <Loader2 className="w-16 h-16 text-white animate-spin mb-6" />
                    <h2 className="text-2xl font-bold text-white mb-2">Verificando Pago...</h2>
                    <p className="text-white/70">Por favor espera un momento.</p>
                </div>
            )}

            {status === 'success' && (
                <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                        <Check className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">¡Pago Exitoso!</h2>

                    <p className="text-white/60 mb-6 text-sm">
                        {emailSent
                            ? "Hemos enviado los detalles y tus números a tu correo electrónico."
                            : "Tu pago se procesó pero no pudimos enviar el correo. ¡No te preocupes! Aquí están tus números:"}
                    </p>

                    {/* Ticket Display Grid */}
                    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                        <h3 className="text-white font-bold mb-4 uppercase tracking-wider text-xs opacity-50">Tus Números de la Suerte</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {ticketNumbers.map(num => (
                                <div key={num} className="bg-white/10 border border-white/10 py-3 rounded-xl text-white font-mono font-bold text-lg shadow-inner">
                                    {num}
                                </div>
                            ))}
                        </div>
                        {ticketNumbers.length === 0 && <p className="text-white/40 italic">Cargando números...</p>}
                    </div>

                    <Link
                        href="/"
                        className="w-full sm:w-auto px-10 py-4 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-xl shadow-white/10"
                    >
                        Volver al Inicio
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col items-center">
                    <div className="w-24 h-24 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                        <X className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">Pago no completado</h2>
                    <p className="text-white/70 mb-8">
                        {message}
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                        <button
                            onClick={() => router.push('/checkout')}
                            className="w-full px-8 py-3 bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold rounded-xl hover:scale-105 transition-transform"
                        >
                            Intentar Nuevamente
                        </button>
                        <Link
                            href="/"
                            onClick={() => {
                                localStorage.removeItem('yvossoeee_selectedNumbers');
                                localStorage.removeItem('yvossoeee_sessionId');
                            }}
                            className="text-white/50 hover:text-white text-sm"
                        >
                            Cancelar y volver al inicio
                        </Link>
                    </div>
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
