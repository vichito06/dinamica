'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                router.push('/admin/dashboard');
                router.refresh(); // Refresh to update middleware state
            } else {
                const data = await res.json();
                setError(data.error || 'Autenticación fallida');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen textured-bg grid-pattern flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-strong p-8 md:p-10 rounded-3xl max-w-md w-full border border-white/10 shadow-2xl"
            >
                <div className="flex justify-center mb-6">
                    <div className="relative w-20 h-20">
                        <Image src="/logo.png" alt="Logo" fill className="object-contain" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-white mb-2 text-center">Panel de Admin</h1>
                <p className="text-white/60 mb-8 text-center text-sm">Acceso restringido a personal autorizado</p>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-white/80 mb-2 font-medium flex items-center gap-2 text-sm">
                            <Lock className="w-4 h-4 text-purple-400" />
                            Contraseña de Administrador
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••••••"
                                className="w-full input-field pl-4 pr-4 py-3 bg-black/40 border-white/10 focus:border-purple-500 transition-colors rounded-xl text-white"
                                autoFocus
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-200 text-sm"
                        >
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </motion.div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Verificando...
                            </>
                        ) : (
                            'Ingresar al Panel'
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-white/20 text-xs text-center">
                        Sistema seguro &bull; End-to-End Encrypted
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                        Acceso solo para administradores.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
