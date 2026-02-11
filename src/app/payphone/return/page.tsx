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

                // PayPhone statusCode: 3 approved, 2 canceled.
                if (response.ok && data.statusCode === 3) {
                    setStatus('success');
                    sessionStorage.removeItem('selectedNumbers');
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
            className="glass-strong p-12 rounded-2xl max-w-lg w-full text-center"
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
                    <div className="w-24 h-24 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                        <Check className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">¡Pago Exitoso!</h2>
                    <p className="text-white/70 mb-8">
                        Tu compra ha sido confirmada. Hemos enviado los detalles a tu correo electrónico.
                    </p>
                    <Link
                        href="/"
                        className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform flex items-center gap-2"
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
