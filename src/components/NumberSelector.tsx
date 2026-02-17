'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Dices, Hash, ShoppingCart, Check, Loader2, ArrowRight } from 'lucide-react';
import { wasHardReload } from '@/lib/navigation';

const MIN_NUMBER = 1;
const MAX_NUMBER = 9999;

// Quantity options: 1, 5, 10, 20, 50
const QUANTITY_OPTIONS = [1, 5, 10, 20, 50, 100];

export default function NumberSelector() {
    const router = useRouter();
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
    const [manualNumber, setManualNumber] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedQuantity, setSelectedQuantity] = useState(1);
    const [soldTickets, setSoldTickets] = useState<string[]>([]);
    const hasReleasedOnMount = useRef(false);

    useEffect(() => {
        if (hasReleasedOnMount.current) return;
        hasReleasedOnMount.current = true;

        const saved = localStorage.getItem('yvossoeee_selectedNumbers');
        const sessionId = localStorage.getItem('yvossoeee_sessionId');

        // 1. HARD RESET: Clear selection ONLY on actual page reload (F5) flag
        if (wasHardReload()) {
            const BRIDGE_KEY = "checkout:selectedTickets";
            const hasStored = saved || sessionId || sessionStorage.getItem(BRIDGE_KEY);

            if (hasStored) {
                console.log("[NumberSelector] Hard Reload: Clearing state zero");

                // Reset local state
                setSelectedNumbers([]);

                // Clear storage
                localStorage.removeItem('yvossoeee_selectedNumbers');
                localStorage.removeItem('yvossoeee_sessionId');
                localStorage.removeItem('selectedNumbers'); // Legacy
                localStorage.removeItem('selectedTickets'); // Legacy
                localStorage.removeItem('ticket-store');    // Legacy
                sessionStorage.removeItem('selectedNumbers'); // Legacy
                sessionStorage.removeItem(BRIDGE_KEY); // Bridge
            }

            if (saved && sessionId) {
                try {
                    const numbers = JSON.parse(saved);
                    if (Array.isArray(numbers) && numbers.length > 0) {
                        console.log("[NumberSelector] Hard Reset: Releasing abandoned selection:", numbers);

                        // Trigger backend liberation (best effort, non-blocking)
                        fetch('/api/tickets/release', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ticketNumbers: numbers, sessionId })
                        }).catch(err => console.error("[NumberSelector] Release failed:", err));
                    }
                } catch (e) {
                    console.error("Error processing abandoned selection", e);
                }
            }
        } else {
            // 2. NORMAL NAVIGATION: Rehydrate if state exists
            if (saved) {
                try {
                    const numbers = JSON.parse(saved);
                    if (Array.isArray(numbers)) {
                        setSelectedNumbers(numbers);
                    }
                } catch (e) {
                    console.error("Error rehydrating selection", e);
                }
            }
        }

        // 3. Page Close/Unload Listener (Best Effort)
        const handleBeforeUnload = () => {
            const currentSaved = localStorage.getItem('yvossoeee_selectedNumbers');
            const currentSession = localStorage.getItem('yvossoeee_sessionId');
            if (currentSaved && currentSession) {
                const blob = new Blob([JSON.stringify({
                    ticketNumbers: JSON.parse(currentSaved),
                    sessionId: currentSession
                })], { type: 'application/json' });
                navigator.sendBeacon('/api/tickets/release', blob);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handleBeforeUnload);

        // 4. Fetch sold tickets
        fetch('/api/tickets/sold')
            .then(res => res.json())
            .then(data => setSoldTickets(data))
            .catch(err => console.error(err));

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);
        };
    }, []);

    useEffect(() => {
        // Simple polling every 30s to keep updated
        const interval = setInterval(() => {
            fetch('/api/tickets/sold')
                .then(res => res.json())
                .then(data => setSoldTickets(data))
                .catch(console.error);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const generateUniqueRandomNumber = (existingNumbers: number[]): number => {
        let attempts = 0;
        let randomNum: number;

        do {
            randomNum = Math.floor(Math.random() * MAX_NUMBER) + MIN_NUMBER;
            const randomStr = randomNum.toString().padStart(4, '0');
            attempts++;
            if (attempts > 10000) {
                throw new Error('No se pueden generar más números únicos');
            }
        } while (existingNumbers.includes(randomNum) || soldTickets.includes(randomNum.toString().padStart(4, '0')));

        return randomNum;
    };

    const generateMultipleNumbers = () => {
        setIsGenerating(true);
        setTimeout(() => {
            try {
                const newNumbers = [...selectedNumbers];

                for (let i = 0; i < selectedQuantity; i++) {
                    const newNum = generateUniqueRandomNumber(newNumbers);
                    newNumbers.push(newNum);
                }

                setSelectedNumbers(newNumbers);
                localStorage.setItem('yvossoeee_selectedNumbers', JSON.stringify(newNumbers));
            } catch (error) {
                alert('No se pudieron generar todos los números solicitados (posiblemente agotados).');
            }
            setIsGenerating(false);
        }, 800);
    };

    const addManualNumber = () => {
        const num = parseInt(manualNumber);
        const numStr = num.toString().padStart(4, '0');

        if (num >= MIN_NUMBER && num <= MAX_NUMBER) {
            if (soldTickets.includes(numStr)) {
                alert(`El número ${numStr} ya ha sido comprado. Por favor elige otro.`);
                return;
            }

            if (!selectedNumbers.includes(num)) {
                const newSelection = [...selectedNumbers, num];
                setSelectedNumbers(newSelection);
                localStorage.setItem('yvossoeee_selectedNumbers', JSON.stringify(newSelection));
                setManualNumber('');
            } else {
                alert('Este número ya está seleccionado');
            }
        }
    };

    const removeNumber = (num: number) => {
        const newSelection = selectedNumbers.filter(n => n !== num);
        setSelectedNumbers(newSelection);
        localStorage.setItem('yvossoeee_selectedNumbers', JSON.stringify(newSelection));
    };

    const handleContinue = () => {
        if (selectedNumbers.length > 0) {
            const BRIDGE_KEY = "checkout:selectedTickets";
            const nums = Array.from(new Set(selectedNumbers)); // dedupe

            // Save to sessionStorage bridge for SPA navigation (pure array as requested)
            console.log("BRIDGE SAVE:", nums);
            sessionStorage.setItem(BRIDGE_KEY, JSON.stringify(nums));
            console.log("BRIDGE RAW:", sessionStorage.getItem(BRIDGE_KEY));

            // Ensure sessionId exists in sessionStorage (stable for the tab session as requested)
            let sessionId = sessionStorage.getItem('yvossoeee_sessionId');
            if (!sessionId) {
                // Check localStorage for continuity if they just navigated in
                sessionId = localStorage.getItem('yvossoeee_sessionId');
                if (!sessionId) {
                    sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : Math.random().toString(36).substring(2);
                    localStorage.setItem('yvossoeee_sessionId', sessionId);
                }
                sessionStorage.setItem('yvossoeee_sessionId', sessionId);
            }

            // Also keep in localStorage for resilience (will be cleared on F5)
            localStorage.setItem('yvossoeee_selectedNumbers', JSON.stringify(nums));

            router.push('/checkout');
        }
    };

    const totalPrice = selectedNumbers.length;

    return (
        <section id="number-selector" className="container-custom">
            <div className="section-box">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                        Selecciona tus Números
                    </h2>

                </motion.div>

                <div className="selector-cards-container grid grid-cols-1 md:grid-cols-2 mb-12" style={{ maxWidth: '1200px', margin: '0 auto', gap: '40px', padding: '0 24px' }}>
                    {/* Multiple Random Generator with Quantity Selector */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="glass-strong p-8 rounded-3xl border border-white/10"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-white/10 border border-white/20 rounded-xl">
                                <Dices className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">Generar Números</h3>
                        </div>
                        <p className="text-gray-400 mb-6">
                            Selecciona cuántos números quieres generar.
                        </p>

                        {/* Quantity Selector */}
                        <div className="mb-6">
                            <label className="block text-white/80 mb-3 font-medium">
                                Cantidad:
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-4 justify-items-center">
                                {QUANTITY_OPTIONS.map((qty) => (
                                    <button
                                        key={qty}
                                        onClick={() => setSelectedQuantity(qty)}
                                        className={`w-16 py-2 px-3 rounded-lg font-bold transition-all ${selectedQuantity === qty
                                            ? 'bg-white text-black'
                                            : 'bg-white/10 text-white hover:bg-white/20'
                                            }`}
                                    >
                                        {qty}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={generateMultipleNumbers}
                            disabled={isGenerating}
                            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:shadow-lg hover:shadow-white/30 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generando {selectedQuantity}...
                                </>
                            ) : (
                                <>
                                    <Dices className="w-5 h-5" />
                                    Generar {selectedQuantity} {selectedQuantity === 1 ? 'Número' : 'Números'}
                                </>
                            )}
                        </button>
                    </motion.div>

                    {/* Manual Entry - 4 digits max */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="glass-strong p-8 rounded-3xl border border-white/10"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-white/10 border border-white/20 rounded-xl">
                                <Hash className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">Número Específico</h3>
                        </div>
                        <p className="text-gray-400 mb-6">
                            ¿Tienes un número favorito? Ingrésalo aquí.
                        </p>
                        <div className="flex gap-3">
                            <input
                                type="number"
                                min={MIN_NUMBER}
                                max={MAX_NUMBER}
                                value={manualNumber}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    // Limit to 4 digits
                                    if (value.length <= 4) {
                                        setManualNumber(value);
                                    }
                                }}
                                onKeyPress={(e) => e.key === 'Enter' && addManualNumber()}
                                placeholder="Ej: 1234"
                                className="flex-1 input-field"
                            />
                            <button
                                onClick={addManualNumber}
                                disabled={!manualNumber || parseInt(manualNumber) < MIN_NUMBER || parseInt(manualNumber) > MAX_NUMBER}
                                className="px-6 py-4 bg-white text-black font-bold rounded-xl hover:shadow-lg hover:shadow-white/30 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-5 h-5" />
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* Selected Numbers Display */}
                {selectedNumbers.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-strong p-8 rounded-3xl border border-white/10"
                    >
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex-1 w-full">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5 text-green-400" />
                                    Tus Números Seleccionados
                                    <span className="bg-white/10 px-2 py-1 rounded text-sm text-white/70 ml-2">
                                        {selectedNumbers.length}
                                    </span>
                                </h3>
                                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                    {selectedNumbers.map((num) => (
                                        <div
                                            key={num}
                                            onClick={() => removeNumber(num)}
                                            className="group relative bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-300 rounded-lg px-3 py-2 cursor-pointer"
                                        >
                                            <span className="font-mono font-bold text-white">
                                                {num.toString().padStart(4, '0')}
                                            </span>
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <div className="w-full h-0.5 bg-red-500 rotate-45 absolute" />
                                                <div className="w-full h-0.5 bg-red-500 -rotate-45 absolute" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="w-full md:w-auto flex flex-col items-center gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-8">
                                <div className="text-center">
                                    <div className="text-white/60 text-sm mb-1">Total a Pagar</div>
                                    <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                                        ${totalPrice}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleContinue}
                                    className="w-full md:w-auto px-8 py-4 bg-white text-black font-bold rounded-xl hover:shadow-lg hover:shadow-white/30 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                                >
                                    Continuar
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </section>
    );
}
