'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Lock, Check, Mail, Phone, User, ArrowLeft, ArrowRight, MapPin, Globe, Hash, Building, AlertCircle, RefreshCw, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { wasHardReload } from '@/lib/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ECUADOR_PROVINCES, COUNTRIES } from '@/lib/data';

type CheckoutStep = 'personal' | 'payment' | 'confirmation';

export default function CheckoutClient() {
    const BRIDGE_KEY = "checkout:selectedTickets";

    const readBridge = (): number[] => {
        try {
            const raw = sessionStorage.getItem(BRIDGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            console.error("[CheckoutClient] Error parsing bridge data", e);
            sessionStorage.removeItem(BRIDGE_KEY); // Clear garbage
            return [];
        }
    };

    const router = useRouter();
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
    const [currentStep, setCurrentStep] = useState<CheckoutStep>('personal');
    const [sessionId, setSessionId] = useState('');

    // Personal Data
    const [personalData, setPersonalData] = useState({
        fullName: '',
        email: '',
        phone: '',
        idNumber: '',
        country: 'Ecuador',
        city: '',
    });

    const [isPaying, setIsPaying] = useState(false);
    const payingRef = useRef(false);
    const [debugInfo, setDebugInfo] = useState<{
        step: 'IDLE' | 'CREATE_SALE' | 'PREPARE' | 'REDIRECT' | 'ERROR';
        saleId?: string;
        prepareStatus?: number;
        contentType?: string;
        requestId?: string;
        dataKeys?: string[];
        urlDetected?: boolean;
        error?: string;
    }>({ step: 'IDLE' });
    const [paymentData, setPaymentData] = useState({
        paymentMethod: 'payphone'
    });
    const [isReserving, setIsReserving] = useState(false);
    const [reserveError, setReserveError] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const hasReleasedOnMount = useRef(false);
    const [isHydrated, setIsHydrated] = useState(false);
    const [hasNoSelection, setHasNoSelection] = useState(false);

    // Debug Mode Logic: dev mode OR ?debug=1
    // (Explicitly hide if ?debug=0)
    const debugParam = searchParams.get('debug');
    const isDebugMode = debugParam === '1' || (process.env.NODE_ENV === 'development' && debugParam !== '0');

    useEffect(() => {
        if (hasReleasedOnMount.current) return;
        hasReleasedOnMount.current = true;

        const savedNumbers = localStorage.getItem('yvossoeee_selectedNumbers');
        const savedSessionId = sessionStorage.getItem('yvossoeee_sessionId') || localStorage.getItem('yvossoeee_sessionId');
        console.log("BRIDGE READ:", sessionStorage.getItem(BRIDGE_KEY));
        const bridgeNums = readBridge();

        const isHard = wasHardReload();

        // 1. HARD RESET: Clear and Redirect ONLY on actual Page Reload (F5) 
        if (isHard) {
            const hasStoredSelection = bridgeNums.length > 0 || savedNumbers;

            if (hasStoredSelection) {
                console.log("[CheckoutClient] Hard Reload with selection. Clearing and redirecting.");

                // State reset
                setSelectedNumbers([]);

                // All persistence cleanup
                localStorage.removeItem('yvossoeee_selectedNumbers');
                localStorage.removeItem('yvossoeee_sessionId');
                localStorage.removeItem('selectedNumbers'); // Legacy
                localStorage.removeItem('selectedTickets'); // Legacy
                localStorage.removeItem('ticket-store');    // Legacy
                sessionStorage.removeItem('selectedNumbers'); // Legacy
                sessionStorage.removeItem(BRIDGE_KEY); // Bridge

                if (savedNumbers && savedSessionId) {
                    try {
                        const numbers = JSON.parse(savedNumbers);
                        if (Array.isArray(numbers) && numbers.length > 0) {
                            fetch('/api/tickets/release', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ticketNumbers: numbers, sessionId: savedSessionId })
                            }).catch(err => console.error("[CheckoutClient] Release failed:", err));
                        }
                    } catch (e) { }
                }

                router.replace('/');
                return;
            }
        }

        // 2. Hydration
        setIsHydrated(true);

        // 3. NORMAL NAVIGATION: Rehydrate and Reserve
        let numbersToSet: number[] = bridgeNums;
        let sessionIdToSet: string = savedSessionId || '';

        // Fallback for localStorage if bridge is empty but storage isn't (resilience)
        if (numbersToSet.length === 0 && savedNumbers) {
            try {
                const parsed = JSON.parse(savedNumbers);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    numbersToSet = parsed;
                }
            } catch (e) { }
        }

        if (numbersToSet.length > 0) {
            setSelectedNumbers(numbersToSet);
            setSessionId(sessionIdToSet);

            // 4. RESERVE ON BACKEND (STRICTLY ONCE ON MOUNT)
            setIsReserving(true);
            setReserveError(null);

            fetch('/api/tickets/reserve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketNumbers: numbersToSet,
                    sessionId: sessionIdToSet
                })
            })
                .then(async (res) => {
                    const data = await res.json();
                    if (!res.ok) {
                        throw new Error(data.error || 'No se pudieron reservar los números.');
                    }
                    return data;
                })
                .catch((err) => {
                    console.error("[CheckoutClient] Reservation failed:", err);
                    setReserveError(err.message || 'Error al reservar los tickets. Intenta de nuevo.');
                })
                .finally(() => {
                    setIsReserving(false);
                });

        } else {
            console.warn("[CheckoutClient] No selection found.");
            sessionStorage.removeItem(BRIDGE_KEY);
            setHasNoSelection(true);
        }

        // 2. Page Close/Unload Listener (Best Effort)
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

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);
        };
    }, [router]);

    const totalPrice = selectedNumbers.length;

    const handlePersonalDataSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReserving) return;

        // Validation: minimum 2 words for fullName
        const nameParts = personalData.fullName.trim().split(/\s+/);
        if (nameParts.length < 2) {
            alert('Por favor ingressa tu nombre completo (Nombre y Apellido).');
            return;
        }

        setIsReserving(true);
        try {
            // Reserve tickets before proceeding to payment
            const response = await fetch('/api/tickets/reserve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketNumbers: selectedNumbers.map((t: number) => t.toString().padStart(4, '0')),
                    sessionId
                })
            });

            const result = await response.json();
            console.log('[Checkout] Reserve status:', response.status, 'code:', result.code);

            if (!response.ok) {
                const errorMsg = result.error || 'Error: Algunos tickets ya no están disponibles. Por favor selecciona otros.';
                console.error('[Checkout] Reservation failed:', result);
                alert(errorMsg);
                if (result.code === 'TICKET_ALREADY_RESERVED' || result.unavailable) {
                    router.push('/');
                }
                return;
            }

            console.log('[Checkout] Reservation successful');
            setCurrentStep('payment');

        } catch (error: any) {
            console.error('Reservation error:', error);
            alert(error.message || 'Error de conexión. Inténtalo de nuevo.');
        } finally {
            setIsReserving(false);
        }
    };

    const splitFullName = (name: string) => {
        const parts = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return { first: "", last: "" };
        if (parts.length === 1) return { first: parts[0], last: "" };

        // Common connectors/prepositions in compound last names
        const connectors = new Set([
            "DE", "DEL", "LA", "LAS", "LOS", "Y",
            "DA", "DO", "DOS", "DAS",
            "VAN", "VON", "DER", "DEN", "DI"
        ]);

        // Default: take last 2 words as last name if 3+ words, else last 1
        let lastCount = parts.length >= 3 ? 2 : 1;

        // If the word before the last is a connector, include it in the last name (e.g., "DEL RIO", "DE LA TORRE")
        // Keep extending backwards while connectors appear.
        let i = parts.length - lastCount;
        while (i - 1 >= 0 && connectors.has(parts[i - 1])) {
            lastCount += 1;
            i -= 1;
        }

        const last = parts.slice(-lastCount).join(" ");
        const first = parts.slice(0, -lastCount).join(" ");

        // Fallback: if first becomes empty (rare), revert to last word logic
        if (!first) return { first: parts[0], last: parts.slice(1).join(" ") };

        return { first, last };
    };

    const handlePaymentSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // 1) Evita doble POST con ref síncrona
        if (payingRef.current) return;
        payingRef.current = true;
        setIsPaying(true);

        setDebugInfo({ step: 'CREATE_SALE' });

        try {
            const { first, last } = splitFullName(personalData.fullName);

            // 1. Create Sale PENDING / Reserve Tickets logic
            const response = await fetch('/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personalData: {
                        firstName: first,
                        lastName: last,
                        email: personalData.email,
                        phone: personalData.phone,
                        idNumber: personalData.idNumber,
                        country: personalData.country,
                        city: personalData.city,
                        name: personalData.fullName.toUpperCase().trim()
                    },
                    tickets: selectedNumbers,
                    total: totalPrice,
                    sessionId
                })
            });

            let result;
            const saleBodyText = await response.text();
            try {
                result = JSON.parse(saleBodyText);
            } catch (err) {
                console.error("[Checkout] Non-JSON response from /api/sales:", saleBodyText.slice(0, 500));
                throw new Error("Respuesta inválida del servidor al crear la venta.");
            }

            if (!response.ok) {
                if (response.status === 409 || result.error) {
                    alert(result.error || 'Error: Algunos números ya no están disponibles.');
                    router.push('/');
                    return;
                }
                throw new Error(result.error || `Error al crear la venta (Status: ${response.status})`);
            }

            // Robust saleId mapping
            const saleId = result.id || result.saleId;
            if (!saleId) throw new Error("No se pudo obtener el ID de la venta.");

            setDebugInfo(prev => ({ ...prev, step: 'PREPARE', saleId }));

            // 2. Call /api/payphone/prepare with saleId (cache: no-store added as requested)
            const prepareResponse = await fetch('/api/payphone/prepare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({ saleId })
            });

            const contentType = prepareResponse.headers.get("content-type") || "";
            const bodyText = await prepareResponse.text();

            let json: any = null;
            let parseError = null;

            if (contentType.includes("application/json")) {
                try {
                    json = JSON.parse(bodyText);
                    // 2) Guarda para debug (por si te redirige y devtools no muestra Response)
                    localStorage.setItem("last_payphone_prepare", JSON.stringify(json));
                    console.log("PAYPHONE_PREPARE", json);
                } catch (e) {
                    parseError = e;
                }
            }

            // Secure Production Log
            console.log(`[Checkout] [DEBUG] Prepare Status: ${prepareResponse.status}, OK: ${prepareResponse.ok}, Type: ${contentType}`);

            setDebugInfo(prev => ({
                ...prev,
                prepareStatus: prepareResponse.status,
                contentType,
                requestId: json?.requestId,
                dataKeys: json?.data ? Object.keys(json.data) : []
            }));

            if (json) {
                console.log(`[Checkout] [DEBUG] JSON Keys:`, {
                    ok: json.ok,
                    code: json.code,
                    requestId: json.requestId,
                    dataKeys: json.data ? Object.keys(json.data) : [],
                    hasPayWithPayPhone: !!json.data?.payWithPayPhone,
                    hasPayWithCard: !!json.data?.payWithCard
                });
            } else {
                console.error(`[Checkout] [DEBUG] Non-JSON or Parse Error. Snippet:`, bodyText.slice(0, 500));
            }

            // 3) DIRECTO A TARJETA (Priority: payWithCard)
            // Extraemos de json?.data o de la raíz del JSON según lo que devuelva el API
            const data = json?.data || json;
            const url = data?.payWithCard ||
                data?.payWithPayPhone ||
                data?.payWithCardUrl ||
                data?.payWithPayPhoneUrl ||
                data?.url ||
                data?.paymentLink;

            // Handle errors or missing link
            console.log('[Checkout] Prepare status:', prepareResponse.status, 'hasUrl:', !!url, 'requestId:', json?.requestId);

            if (!prepareResponse.ok || !json?.ok || !url) {
                const status = prepareResponse.status;
                const code = json?.code || "NO_CODE";
                const reqId = json?.requestId || "NO_ID";
                const keys = json?.data ? Object.keys(json.data).join(',') : "no-data";

                let errorMsg = `No se pudo obtener el link de pago.\n\nDetalles:\nStatus: ${status}\nCode: ${code}\nReqID: ${reqId}\nAvailable Data Keys: ${keys}`;

                if (json?.code === "PAYPHONE_CIRCUIT_OPEN") {
                    errorMsg = "Proveedor en pausa (Circuit Breaker), intenta en 60s.";
                } else if (!json && !prepareResponse.ok) {
                    errorMsg = `Error de red o servidor (${status}). Por favor revisa tu conexión.`;
                } else if (json?.ok && !url) {
                    errorMsg = `PayPhone respondió OK pero no envió URL.\nStatus: ${status}\nReqID: ${reqId}\nKeys: ${keys}`;
                }

                throw new Error(errorMsg);
            }

            setDebugInfo(prev => ({ ...prev, step: 'REDIRECT', urlDetected: true }));

            // 4. Standard Redirection - Use assign to prevent browser blocking
            try {
                window.location.assign(url);
            } catch (err) {
                console.error("[Checkout] Redirection blocked or failed:", err);
                setIsPaying(false);
                setManualPayUrl(url); // Show fallback button
            }

        } catch (error: any) {
            console.error('Checkout error:', error);
            setDebugInfo(prev => ({ ...prev, step: 'ERROR', error: error.message }));
            alert(error.message || 'No se pudo iniciar el pago. Intenta nuevamente.');
            setIsPaying(false); // ✅ Permitir reintento si falla
        } finally {
            // si falla o termina, libera el candado
            payingRef.current = false;
            setIsPaying(false);
        }
    };

    const handleRemoveTicket = async (ticket: number) => {
        const confirmMsg = `¿Estás seguro de que quieres eliminar el ticket ${ticket.toString().padStart(4, '0')}?`;
        if (!window.confirm(confirmMsg)) return;

        if (currentStep === 'payment') {
            try {
                // Liberate ticket on backend if already reserved (Payment step)
                await fetch('/api/tickets/release', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticketNumber: ticket, sessionId })
                });
            } catch (e) {
                console.error("Error releasing ticket", e);
            }
        }

        const newNumbers = selectedNumbers.filter(n => n !== ticket);
        setSelectedNumbers(newNumbers);
        localStorage.setItem('yvossoeee_selectedNumbers', JSON.stringify(newNumbers));

        if (newNumbers.length === 0) {
            router.push('/');
        }
    };

    // State for manual PayPhone link (Fallback)
    const [manualPayUrl, setManualPayUrl] = useState<string | null>(null);

    if (hasNoSelection) {
        return (
            <div className="min-h-screen textured-bg grid-pattern flex items-center justify-center p-4">
                <div className="glass-strong p-8 rounded-2xl max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">No se encontraron números</h2>
                    <p className="text-white/60 mb-8 text-sm">
                        Tu carrito está vacío o la sesión expiró. Regresa al inicio para seleccionar tus números.
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full py-3 bg-white text-black font-bold rounded-xl hover:shadow-lg transition-all"
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    if (manualPayUrl) {
        return (
            <div className="min-h-screen textured-bg grid-pattern flex items-center justify-center p-4">
                <div className="glass-strong p-8 rounded-2xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CreditCard className="w-8 h-8 text-orange-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">¡Link de Pago Listo!</h2>
                    <p className="text-white/70 mb-8">
                        Si no fuiste redirigido automáticamente, haz clic abajo para completar tu pago de forma segura en PayPhone.
                    </p>
                    <button
                        onClick={() => window.location.assign(manualPayUrl)}
                        className="block w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/40 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-wide mb-4 text-lg"
                    >
                        Abrir Link de Pago
                    </button>
                    <button
                        onClick={() => setManualPayUrl(null)}
                        className="text-white/40 hover:text-white transition-colors text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4 inline mr-1" />
                        Regresar al Checkout
                    </button>
                </div>
            </div>
        );
    }

    if (!isHydrated) {
        return (
            <div className="min-h-screen textured-bg grid-pattern flex items-center justify-center">
                <RefreshCw className="w-12 h-12 text-white animate-spin opacity-20" />
            </div>
        );
    }

    if (reserveError) {
        return (
            <div className="min-h-screen textured-bg grid-pattern flex items-center justify-center p-4">
                <div className="glass-strong p-8 rounded-2xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Error de Reserva</h2>
                    <p className="text-white/70 mb-8">{reserveError}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full py-4 bg-white text-black font-bold rounded-xl hover:shadow-lg transition-all hover:scale-[1.02]"
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    if (!selectedNumbers.length) {
        return (
            <div className="min-h-screen textured-bg grid-pattern flex items-center justify-center">
                <div className="text-center">
                    <p className="text-white/70 mb-4">No se encontraron números seleccionados.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:scale-105 transition-transform"
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen textured-bg grid-pattern py-12">
            {/* Fixed Header with Logo */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
                <div className="container-custom py-3 flex items-center justify-center gap-3">
                    <Image src="/logo.png" alt="Logo" width={40} height={40} />
                    <span className="text-white font-bold">Y Voss Oeee - Dinámica 1</span>
                </div>
            </div>

            <div className="container-custom max-w-6xl pt-24">
                {/* Back Button */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <button
                        onClick={() => currentStep === 'personal' ? router.push('/') : setCurrentStep('personal')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver
                    </button>
                </motion.div>

                {/* Progress Steps */}
                <div className="mb-12">
                    <div className="stepper" style={{ maxWidth: '1100px', margin: '18px auto 0', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '140px' }}>
                        <StepIndicator
                            number={1}
                            title="Datos Personales"
                            active={currentStep === 'personal'}
                            completed={currentStep === 'payment' || currentStep === 'confirmation'}
                        />
                        <div className={`step-line ${currentStep !== 'personal' ? 'bg-white' : 'bg-white/10'}`} />
                        <StepIndicator
                            number={2}
                            title="Pago"
                            active={currentStep === 'payment'}
                            completed={currentStep === 'confirmation'}
                        />
                        <div className={`step-line ${currentStep === 'confirmation' ? 'bg-white' : 'bg-white/10'}`} style={{ flexGrow: 4 }} />
                        <StepIndicator
                            number={3}
                            title="Confirmación"
                            active={currentStep === 'confirmation'}
                            completed={false}
                        />
                    </div>
                </div>

                <div className="grid lg:grid-cols-4 gap-8">
                    {/* Order Summary - Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="glass-strong p-4 rounded-xl sticky top-4 min-h-0">
                            <div className="pb-3 border-b border-white/10 mb-3">
                                <h2 className="text-xl font-bold text-white">Resumen</h2>
                            </div>

                            <div className="space-y-3">
                                {/* Bloque Seleccionados con Divisor */}
                                <div>
                                    <div className="text-white/60 text-xs mb-2 font-medium">Números Seleccionados ({selectedNumbers.length})</div>
                                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                        {selectedNumbers.slice(0, 15).map((num) => (
                                            <div
                                                key={num}
                                                className="group relative p-2 bg-white/10 border border-white/10 text-white rounded text-center font-mono font-bold text-xs flex items-center justify-center gap-2"
                                            >
                                                {num.toString().padStart(4, '0')}
                                                <button
                                                    onClick={() => handleRemoveTicket(num)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-500 rounded flex-shrink-0"
                                                    title="Eliminar"
                                                >
                                                    <XCircle className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    {selectedNumbers.length > 15 && (
                                        <p className="text-white/50 text-xs mt-2 text-center">+{selectedNumbers.length - 15} más</p>
                                    )}
                                </div>

                                <div className="border-t border-white/10 pt-6 mt-4">
                                    <div className="flex justify-between text-white/70 mb-3 text-base">
                                        <span>Subtotal</span>
                                        <span>${totalPrice}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-white font-bold text-lg">Total</span>
                                        <span className="text-3xl font-bold text-white">${totalPrice}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Form Area */}
                    <div className="lg:col-span-3">
                        <AnimatePresence mode="wait">
                            {currentStep === 'personal' && (
                                <PersonalDataForm
                                    data={personalData}
                                    setData={setPersonalData}
                                    onSubmit={handlePersonalDataSubmit}
                                    loading={isReserving}
                                    selectedNumbers={selectedNumbers}
                                />
                            )}

                            {currentStep === 'payment' && (
                                <PaymentForm
                                    data={paymentData}
                                    setData={setPaymentData}
                                    onSubmit={handlePaymentSubmit}
                                    onBack={() => setCurrentStep('personal')}
                                    loading={isPaying}
                                />
                            )}

                            {currentStep === 'confirmation' && (
                                <ConfirmationScreen />
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* DEBUG PANEL */}
            {isDebugMode && debugInfo.step !== 'IDLE' && (
                <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-full">
                    <div className="glass-strong border border-white/20 p-4 rounded-xl text-[10px] font-mono shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-1">
                            <span className="text-orange-400 font-bold uppercase">PayPhone Debug (Live)</span>
                            <button onClick={() => setDebugInfo({ step: 'IDLE' })} className="text-white/50 hover:text-white">✕</button>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span className="text-white/40">STEP:</span>
                                <span className={`${debugInfo.step === 'ERROR' ? 'text-red-400' : 'text-green-400'} font-bold`}>{debugInfo.step}</span>
                            </div>
                            {debugInfo.saleId && (
                                <div className="flex justify-between">
                                    <span className="text-white/40">SALE_ID:</span>
                                    <span className="text-white truncate ml-2">{debugInfo.saleId}</span>
                                </div>
                            )}
                            {debugInfo.prepareStatus && (
                                <div className="flex justify-between">
                                    <span className="text-white/40">STATUS:</span>
                                    <span className="text-white">{debugInfo.prepareStatus} ({debugInfo.contentType?.split(';')[0]})</span>
                                </div>
                            )}
                            {debugInfo.requestId && (
                                <div className="flex justify-between">
                                    <span className="text-white/40">REQ_ID:</span>
                                    <span className="text-white truncate ml-2">{debugInfo.requestId}</span>
                                </div>
                            )}
                            {debugInfo.dataKeys && debugInfo.dataKeys.length > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-white/40">DATA_KEYS:</span>
                                    <span className="text-white truncate ml-2">[{debugInfo.dataKeys.join(', ')}]</span>
                                </div>
                            )}
                            {debugInfo.urlDetected && (
                                <div className="flex justify-between">
                                    <span className="text-white/40">URL_FOUND:</span>
                                    <span className="text-green-400 font-bold">YES ✅</span>
                                </div>
                            )}
                            {debugInfo.error && (
                                <div className="mt-2 p-2 bg-red-500/20 border border-red-500/40 rounded text-red-200 break-words leading-tight">
                                    {debugInfo.error}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Step Indicator Component
function StepIndicator({ number, title, active, completed }: any) {
    return (
        <div className="flex flex-col items-center gap-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${completed ? 'bg-green-500 text-white' :
                active ? 'bg-white text-black' :
                    'bg-white/10 text-white/50'
                }`}>
                {completed ? <Check className="w-6 h-6" /> : number}
            </div>
            <span className={`text-xs font-medium hidden md:block ${active ? 'text-white' : 'text-white/50'}`}>
                {title}
            </span>
        </div>
    );
}

// Personal Data Form
function PersonalDataForm({ data, setData, onSubmit, loading, selectedNumbers }: any) {
    const router = useRouter();
    const isEcuador = data.country === 'Ecuador';

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass-strong p-8 rounded-2xl max-w-2xl mx-auto"
        >
            <button
                type="button"
                onClick={() => router.back()}
                className="mb-10 mt-2 ml-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-xl shadow-[0_10px_22px_rgba(229,57,53,0.25)] border border-red-500/30 hover:shadow-red-500/40 active:scale-95 transition-all flex items-center gap-2 group tracking-wide text-xs"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                ATRÁS
            </button>
            <h2 className="text-2xl font-bold text-white mb-8">Datos Personales</h2>

            <form onSubmit={onSubmit} className="space-y-8">
                {/* ID Number */}
                <div>
                    <label className="block text-white/80 mb-3 font-medium flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Número de Cédula/ID *
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={data.idNumber}
                        onChange={(e) => setData({ ...data, idNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="1712345678"
                        maxLength={10}
                        className="w-full input-field py-4"
                    />
                </div>

                {/* Name */}
                <div>
                    <label className="block text-white/80 mb-3 font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Nombre completo *
                    </label>
                    <input
                        type="text"
                        required
                        value={data.fullName}
                        onChange={(e) => setData({ ...data, fullName: e.target.value.toUpperCase() })}
                        placeholder="JUAN PÉREZ GARCÍA"
                        className="w-full input-field py-4"
                    />
                </div>



                <div className="grid md:grid-cols-2 gap-4">
                    {/* Email */}
                    <div>
                        <label className="block text-white/80 mb-2 font-medium flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email *
                        </label>
                        <input
                            type="email"
                            required
                            value={data.email}
                            onChange={(e) => setData({ ...data, email: e.target.value })}
                            placeholder="tu@email.com"
                            className="w-full input-field"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-white/80 mb-3 font-medium flex items-center gap-2 text-lg">
                            <Phone className="w-5 h-5" />
                            Teléfono *
                        </label>
                        <input
                            type="tel"
                            inputMode="numeric"
                            required
                            value={data.phone}
                            onChange={(e) => setData({ ...data, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                            placeholder="0987654321"
                            maxLength={10}
                            className="w-full input-field py-4"
                        />
                    </div>
                </div>

                {/* Country */}
                <div>
                    <label className="block text-white/80 mb-2 font-medium flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        País *
                    </label>
                    <select
                        required
                        disabled
                        value={data.country}
                        onChange={(e) => setData({ ...data, country: e.target.value, province: '', city: '' })}
                        className="w-full input-field opacity-70 cursor-not-allowed text-white/50"
                    >
                        <option value="Ecuador" style={{ color: '#111', backgroundColor: '#fff' }}>Ecuador</option>
                    </select>
                </div>

                {/* Ecuador-specific fields */}
                {isEcuador && (
                    <>
                        <div>
                            <label className="block text-white/80 mb-2 font-medium flex items-center gap-2">
                                <Building className="w-4 h-4" />
                                Cantón/Ciudad *
                            </label>
                            <input
                                type="text"
                                required
                                value={data.city}
                                onChange={(e) => setData({ ...data, city: e.target.value })}
                                placeholder="Quito, Guayaquil, etc."
                                className="w-full input-field"
                            />
                        </div>
                    </>
                )}

                {/* For non-Ecuador countries */}
                {!isEcuador && data.country && (
                    <div>
                        <label className="block text-white/80 mb-2 font-medium flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            Ciudad *
                        </label>
                        <input
                            type="text"
                            required
                            value={data.city}
                            onChange={(e) => setData({ ...data, city: e.target.value })}
                            placeholder="Ciudad"
                            className="w-full input-field"
                        />
                    </div>
                )}

                {/* Terms & Privacy Checkbox */}
                <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl my-6">
                    <input
                        type="checkbox"
                        id="terms"
                        required
                        className="w-5 h-5 mt-1 rounded border-white/20 bg-black/40 text-green-500 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <label htmlFor="terms" className="text-sm text-white/80 cursor-pointer select-none leading-relaxed">
                        Acepto los <Link href="/terms" target="_blank" className="text-white font-bold hover:underline decoration-white/30">Términos y Condiciones</Link> y la <Link href="/policy" target="_blank" className="text-white font-bold hover:underline decoration-white/30">Política de Privacidad</Link>. Entiendo que mis datos serán tratados para la gestión de esta dinámica.
                    </label>
                </div>

                <div className="flex gap-4 items-center">
                    {/* Back button removed from here */}
                    <button
                        type="submit"
                        disabled={loading || !selectedNumbers || selectedNumbers.length === 0}
                        className="flex-1 py-4 bg-white text-black font-bold rounded-xl hover:shadow-lg hover:shadow-white/30 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                Reservando...
                            </>
                        ) : (
                            <>
                                Continuar al Pago
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </form>
        </motion.div >
    );
}

// Payment Form - Payphone Only
function PaymentForm({ data, setData, onSubmit, onBack, loading }: any) {
    const handleSubmit = async (e: React.FormEvent) => {
        await onSubmit(e);
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass-strong p-8 rounded-2xl"
        >
            <button
                type="button"
                onClick={onBack}
                className="mb-10 mt-2 ml-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-xl shadow-[0_10px_22px_rgba(229,57,53,0.25)] border border-red-500/30 hover:shadow-red-500/40 active:scale-95 transition-all flex items-center gap-2 group tracking-wide text-xs"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                ATRÁS
            </button>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <CreditCard className="w-6 h-6" />
                Pago con Payphone
            </h2>

            <div className="space-y-6">
                <div className="p-6 bg-white/5 border border-white/10 rounded-xl text-center">
                    <p className="text-white/80 mb-4 text-sm leading-relaxed">
                        (Aquí no ingresas tu tarjeta. <strong>PayPhone</strong> te redirige a una página segura para pagar con tarjeta de crédito o débito.)
                    </p>
                    <Image
                        src="/payphone-logo.png"
                        alt="PayPhone"
                        width={150}
                        height={50}
                        className="mx-auto opacity-90 my-4"
                        style={{ filter: "brightness(0) invert(1)" }}
                    />
                </div>

                {/* Security Notice */}
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <div className="flex gap-3">
                        <Lock className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <div className="text-sm text-white/80">
                            <div className="font-semibold text-white mb-1">Pago seguro</div>
                            Tu transacción es procesada por PayPhone.
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/50 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-6 h-6 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <CreditCard className="w-6 h-6" />
                                Pagar con PayPhone
                            </>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// Confirmation Screen
function ConfirmationScreen() {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-strong p-12 rounded-2xl text-center"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-24 h-24 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6"
            >
                <Check className="w-12 h-12 text-white" />
            </motion.div>

            <h2 className="text-3xl font-bold text-white mb-4">¡Compra Exitosa!</h2>
            <p className="text-white/70 mb-8 max-w-md mx-auto">
                Tus números han sido registrados exitosamente. Recibirás un email de confirmación en breve.
            </p>

            <div className="animate-pulse text-white/50 text-sm">
                Redirigiendo al inicio...
            </div>
        </motion.div>
    );
}
