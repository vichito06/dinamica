'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function PayPhoneCancelPage() {
    const router = useRouter();

    useEffect(() => {
        // Optional: Call an endpoint to explicitly release tickets if we had the saleId
        // But the cleanup cron will handle it eventually, or we can rely on the user trying again.
        // Since we don't get saleId in cancel url by default unless we embed it, we just redirect.

        const timer = setTimeout(() => {
            router.push('/');
        }, 2000);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="min-h-screen textured-bg grid-pattern flex items-center justify-center p-4">
            <div className="glass-strong p-8 rounded-2xl text-center">
                <Loader2 className="w-12 h-12 text-white/50 animate-spin mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white">Cancelando proceso...</h2>
                <p className="text-white/60 mt-2">Redirigiendo al inicio.</p>
            </div>
        </div>
    );
}
