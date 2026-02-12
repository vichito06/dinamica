'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Dices, Hash, ShoppingCart, Check, Loader2, ArrowRight } from 'lucide-react';

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

    useEffect(() => {
        // Load persist selection
        const saved = localStorage.getItem('yvossoeee_selectedNumbers');
        if (saved) {
            try {
                setSelectedNumbers(JSON.parse(saved));
            } catch (e) {
                console.error("Error loading saved numbers", e);
            }
        }

        // Fetch sold tickets
        fetch('/api/tickets/sold')
            .then(res => res.json())
            .then(data => setSoldTickets(data))
            .catch(err => console.error(err));
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
            // Generate or get sessionId
            let sessionId = localStorage.getItem('yvossoeee_sessionId');
            if (!sessionId) {
                sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : Math.random().toString(36).substring(2);
                localStorage.setItem('yvossoeee_sessionId', sessionId);
            }

            localStorage.setItem('yvossoeee_selectedNumbers', JSON.stringify(selectedNumbers));
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
