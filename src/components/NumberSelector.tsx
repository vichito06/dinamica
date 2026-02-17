import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Dices, Hash, ShoppingCart, Check, Loader2, ArrowRight } from 'lucide-react';
import { wasHardReload } from '@/lib/navigation';
import Modal from './Modal';

const MIN_NUMBER = 1;
const MAX_NUMBER = 9999;

// Quantity options: 1, 5, 10, 20, 50
const QUANTITY_OPTIONS = [1, 5, 10, 20, 50, 100];

// Number range configuration

interface NumberSelectorProps {
    isOpen?: boolean;
    onClose?: () => void;
    isInline?: boolean;
}

export default function NumberSelector({ isOpen, onClose, isInline = false }: NumberSelectorProps) {
    const router = useRouter();
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
    const [manualNumber, setManualNumber] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedQuantity, setSelectedQuantity] = useState(1);
    const [soldTickets, setSoldTickets] = useState<string[]>([]);
    const hasReleasedOnMount = useRef(false);
    const inFlightRef = useRef(false);
    const lastSoldFetchRef = useRef(0);
    const mountedRef = useRef(true);

    // 1. Initial hydration and session setup (Always runs on mount)
    useEffect(() => {
        if (hasReleasedOnMount.current) return;
        hasReleasedOnMount.current = true;

        const BRIDGE_KEY = "checkout:selectedTickets";
        const SESSION_ID_KEY = "yvossoeee_sessionId";

        if (wasHardReload()) {
            const saved = sessionStorage.getItem(BRIDGE_KEY);
            const sessionId = sessionStorage.getItem(SESSION_ID_KEY);

            setSelectedNumbers([]);
            sessionStorage.removeItem(BRIDGE_KEY);
            localStorage.removeItem('yvossoeee_selectedNumbers');
            localStorage.removeItem('selectedNumbers');

            if (saved && sessionId) {
                try {
                    const numbers = JSON.parse(saved);
                    if (Array.isArray(numbers) && numbers.length > 0) {
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
            const saved = sessionStorage.getItem(BRIDGE_KEY);
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

        let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
        if (!sessionId) {
            sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random().toString(36).substring(2);
            sessionStorage.setItem(SESSION_ID_KEY, sessionId);
        }

        const handleBeforeUnload = () => {
            const currentSaved = sessionStorage.getItem(BRIDGE_KEY);
            const currentSession = sessionStorage.getItem(SESSION_ID_KEY);
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

        return () => {
            mountedRef.current = false;
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);
        };
    }, []);

    const intervalRef = useRef<any>(null);

    // 2. Definitive Anti-Duplication Polling logic
    const fetchSold = useCallback(() => {
        // 0. Unmount guard
        if (!mountedRef.current) return;

        // 1. In-flight lock: don't start if already fetching
        if (inFlightRef.current) return;

        const now = Date.now();
        // 2. Short dedupe: avoid spam if React re-renders/mounts rapidly (2s)
        if (now - lastSoldFetchRef.current < 2000) return;

        inFlightRef.current = true;
        lastSoldFetchRef.current = now;

        fetch('/api/tickets/sold')
            .then(res => res.json())
            .then(data => {
                if (!mountedRef.current) return;

                // 3. Data-driven deduping: only update state if data actually changed
                // (Using stringify for a simple array comparison)
                setSoldTickets((prev) => {
                    if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
                    return data;
                });
            })
            .catch(console.error)
            .finally(() => {
                if (mountedRef.current) {
                    inFlightRef.current = false;
                }
            });
    }, []);

    useEffect(() => {
        // SOLO si modal está abierto
        if (!isOpen) return;

        // si pestaña oculta, no hagas nada (evita fetch al abrir si está en background)
        if (document.hidden) return;

        // 1) fetch inmediato al abrir
        fetchSold();

        // 2) no crear interval si ya existe (guard)
        if (intervalRef.current) return;

        intervalRef.current = window.setInterval(() => {
            if (document.hidden) return;
            fetchSold();
        }, 60000); // 60s

        // 3) cleanup SIEMPRE
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isOpen]); // 👈 SOLO isOpen


    const generateMultipleNumbers = async () => {
        setIsGenerating(true);
        const SESSION_ID_KEY = "yvossoeee_sessionId";
        const BRIDGE_KEY = "checkout:selectedTickets";
        const sessionId = sessionStorage.getItem(SESSION_ID_KEY);

        try {
            const res = await fetch('/api/tickets/pick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: selectedQuantity, sessionId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al generar números.');

            const pickedNumbers = data.ticketNumbers.map((n: string) => parseInt(n, 10));
            const newSelection = [...pickedNumbers];

            if (pickedNumbers.length < selectedQuantity) {
                alert(`Solo quedan ${pickedNumbers.length} tickets disponibles. Se han seleccionado todos los sobrantes.`);
            }

            setSelectedNumbers(newSelection);
            sessionStorage.setItem(BRIDGE_KEY, JSON.stringify(newSelection));

        } catch (error: any) {
            console.error("[NumberSelector] Pick failed:", error);
            alert(error.message || 'No se pudieron generar los números. Intenta de nuevo.');
        } finally {
            setIsGenerating(false);
        }
    };

    const addManualNumber = async () => {
        const num = parseInt(manualNumber);
        const numStr = num.toString().padStart(4, '0');
        const sessionId = sessionStorage.getItem('yvossoeee_sessionId');

        if (num >= MIN_NUMBER && num <= MAX_NUMBER) {
            if (selectedNumbers.includes(num)) {
                alert('Este número ya está en tu lista.');
                return;
            }

            try {
                setIsGenerating(true);
                const res = await fetch('/api/tickets/reserve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticketNumbers: [numStr], sessionId })
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Este número no está disponible.');
                }

                const newSelection = [...selectedNumbers, num];
                setSelectedNumbers(newSelection);
                sessionStorage.setItem('checkout:selectedTickets', JSON.stringify(newSelection));
                setManualNumber('');

            } catch (error: any) {
                console.error("[NumberSelector] Manual reserve failed:", error);
                alert(error.message);
            } finally {
                setIsGenerating(false);
            }
        }
    };

    const removeNumber = (num: number) => {
        const newSelection = selectedNumbers.filter(n => n !== num);
        setSelectedNumbers(newSelection);
        sessionStorage.setItem('checkout:selectedTickets', JSON.stringify(newSelection));
    };

    const handleContinue = () => {
        if (selectedNumbers.length > 0) {
            const BRIDGE_KEY = "checkout:selectedTickets";
            const nums = Array.from(new Set(selectedNumbers)); // dedupe
            sessionStorage.setItem(BRIDGE_KEY, JSON.stringify(nums));
            router.push('/checkout');
        }
    };

    const totalPrice = selectedNumbers.length;

    const content = (
        <>
            <div className="selector-cards-container grid grid-cols-1 md:grid-cols-2 mb-12 gap-8">
                {/* Multiple Random Generator */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
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

                    <div className="mb-6">
                        <label className="block text-white/80 mb-3 font-medium">
                            Cantidad:
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4 justify-items-center">
                            {QUANTITY_OPTIONS.map((qty) => (
                                <button
                                    key={qty}
                                    onClick={() => setSelectedQuantity(qty)}
                                    className={`w-12 py-2 rounded-lg font-bold transition-all ${selectedQuantity === qty
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
                                Generando...
                            </>
                        ) : (
                            <>
                                <Dices className="w-5 h-5" />
                                Generar {selectedQuantity} {selectedQuantity === 1 ? 'Número' : 'Números'}
                            </>
                        )}
                    </button>
                </motion.div>

                {/* Manual Entry */}
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
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
                                if (value.length <= 4) setManualNumber(value);
                            }}
                            onKeyPress={(e) => e.key === 'Enter' && addManualNumber()}
                            placeholder="Ej: 1234"
                            className="flex-1 input-field"
                        />
                        <button
                            onClick={addManualNumber}
                            disabled={!manualNumber || parseInt(manualNumber) < MIN_NUMBER || parseInt(manualNumber) > MAX_NUMBER}
                            className="px-6 py-4 bg-white text-black font-bold rounded-xl"
                        >
                            <Check className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Selected Numbers */}
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
        </>
    );

    if (isInline) {
        return content;
    }

    return (
        <Modal
            isOpen={isOpen || false}
            onClose={onClose || (() => { })}
            title="Selecciona tus Números"
            maxWidth="1200px"
        >
            {content}
        </Modal>
    );
}
