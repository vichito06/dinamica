"use client";

import { X } from "lucide-react";
import Link from "next/link";

export default function PayphoneCancelPage() {
    return (
        <div className="min-h-screen textured-bg grid-pattern flex items-center justify-center p-4">
            <div className="glass-strong p-8 rounded-2xl max-w-md w-full text-center">
                <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                    <X className="w-10 h-10 text-red-500" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-4">Pago Cancelado</h2>

                <p className="text-white/70 mb-8">
                    La transacción fue cancelada. No se ha realizado ningún cargo a tu tarjeta.
                </p>

                <div className="flex flex-col gap-3">
                    <Link
                        href="/checkout"
                        className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:scale-105 transition-transform"
                    >
                        Intentar de nuevo
                    </Link>
                    <Link
                        href="/"
                        className="px-8 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
                    >
                        Volver al Inicio
                    </Link>
                </div>
            </div>
        </div>
    );
}
