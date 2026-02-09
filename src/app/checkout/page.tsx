'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Lock, Check, Mail, Phone, User, ArrowLeft, ArrowRight, MapPin, Globe, Hash, Building, AlertCircle, RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ECUADOR_PROVINCES, COUNTRIES } from '@/lib/data';

type CheckoutStep = 'personal' | 'payment' | 'confirmation';

export default function CheckoutPage() {
    const router = useRouter();
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
    const [currentStep, setCurrentStep] = useState<CheckoutStep>('personal');
    const [sessionId, setSessionId] = useState('');

    // Personal Data
    const [personalData, setPersonalData] = useState({
        firstName: '',
        lastName: '',
        // name property will be composed on submission
        email: '',
        phone: '',
        idNumber: '',
        country: 'Ecuador',
        province: '',
        city: '',
        postalCode: ''
    });

    // Payment Data - Simply method
    const [paymentData, setPaymentData] = useState({
        paymentMethod: 'payphone'
    });

    useEffect(() => {
        const numbers = sessionStorage.getItem('selectedNumbers');
        if (numbers) setSelectedNumbers(JSON.parse(numbers));
        setSessionId(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
    }, []);

    const totalPrice = selectedNumbers.length;

    const handlePersonalDataSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // Reserve tickets before proceeding to payment
            const response = await fetch('/api/tickets/reserve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tickets: selectedNumbers.map((t: number) => t.toString().padStart(4, '0')),
                    sessionId
                })
            });

            if (!response.ok) {
                const result = await response.json();
                alert(result.error || 'Error: Algunos tickets ya no están disponibles. Por favor selecciona otros.');
                if (result.unavailable) {
                    // Could highlight unavailable tickets, but redirecting is safer for MVP
                    router.push('/');
                }
                return;
            }

            setCurrentStep('payment');

        } catch (error) {
            console.error('Reservation error:', error);
            alert('Error de conexión. Inténtalo de nuevo.');
        }
    };

    const handlePaymentSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        try {
            // New Payload for Payphone
            // 1. Create Sale PENDING / Reserve Tickets logic
            const response = await fetch('/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personalData: {
                        firstName: personalData.firstName,
                        lastName: personalData.lastName,
                        email: personalData.email,
                        phone: personalData.phone,
                        idNumber: personalData.idNumber,
                        country: personalData.country,
                        province: personalData.province,
                        city: personalData.city,
                        postalCode: personalData.postalCode || '',
                        name: `${personalData.lastName} ${personalData.firstName}`.trim()
                    },
                    tickets: selectedNumbers,
                    total: totalPrice,
                    sessionId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                if (response.status === 409 || result.error) {
                    alert(result.error || 'Error: Algunos números ya no están disponibles.');
                    router.push('/');
                    return;
                }
                throw new Error(result.error);
            }

            const saleId = result.id;

            // 2. Call /api/payphone/prepare with saleId
            const prepareResponse = await fetch('/api/payphone/prepare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saleId })
            });

            const prepareData = await prepareResponse.json();

            if (!prepareResponse.ok) {
                console.error("Prepare error", prepareData);
                const reqId = prepareData.requestId ? ` (ReqID: ${prepareData.requestId})` : "";

                // Show specific missing variables if any
                if (prepareData.missing) {
                    throw new Error(`Configuración incompleta: ${prepareData.missing.join(', ')}${reqId}`);
                }
                throw new Error((prepareData.error || "Error al conectar con Payphone") + reqId);
            }

            // 3. Redirect to payUrl (Robust check)
            const url = prepareData.paymentUrl || prepareData.url || prepareData.payUrl;

            if (!url) {
                console.log("Respuesta prepare:", prepareData);
                const reqId = prepareData.requestId ? ` (ReqID: ${prepareData.requestId})` : "";
                alert("No llegó el link de pago desde PayPhone." + reqId);
                return;
            }

            // Fallback UI included in alert if assignment fails (though hard to catch sync) or just relying on browser
            // To be robust as requested: "Si el navegador bloquea o falla, muestra un botón/anchor visible"
            // We can set a state here to show the manually clickable link.

            try {
                window.location.assign(url);
            } catch (err) {
                // Force user to click
                alert("Redirección bloqueada. Por favor usa el botón que aparecerá a continuación.");
            }

            // In case redirection is slow or blocked, we can update UI to show a button
            // But we don't have a state for "Manual Pay Link" easily accesible in this function without modifying state structure.
            // For now, let's just rely on the standard behavior but we can throw to the catch block to alert.

        } catch (error: any) {
            console.error('Error processing payment:', error);
            // Check if error message is about missing config
            if (error.message && error.message.includes("Configuración incompleta")) {
                alert(error.message);
            } else {
                alert(`No se pudo iniciar el pago. ${error.message || ""}`);
            }
        }
    };

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
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {selectedNumbers.slice(0, 9).map((num) => (
                                            <div
                                                key={num}
                                                className="p-2 bg-white/10 border border-white/10 text-white rounded text-center font-mono font-bold text-xs"
                                            >
                                                {num.toString().padStart(4, '0')}
                                            </div>
                                        ))}
                                    </div>
                                    {selectedNumbers.length > 9 && (
                                        <p className="text-white/50 text-xs mt-2">+{selectedNumbers.length - 9} más</p>
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
                                />
                            )}

                            {currentStep === 'payment' && (
                                <PaymentForm
                                    data={paymentData}
                                    setData={setPaymentData}
                                    onSubmit={handlePaymentSubmit}
                                    onBack={() => setCurrentStep('personal')}
                                />
                            )}

                            {currentStep === 'confirmation' && (
                                <ConfirmationScreen />
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
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
function PersonalDataForm({ data, setData, onSubmit }: any) {
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
                {/* Name & Last Name */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-white/80 mb-3 font-medium flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Apellidos *
                        </label>
                        <input
                            type="text"
                            required
                            value={data.lastName}
                            onChange={(e) => setData({ ...data, lastName: e.target.value.toUpperCase() })}
                            placeholder="PÉREZ GARCÍA"
                            className="w-full input-field py-4"
                        />
                    </div>
                    <div>
                        <label className="block text-white/80 mb-3 font-medium flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Nombres *
                        </label>
                        <input
                            type="text"
                            required
                            value={data.firstName}
                            onChange={(e) => setData({ ...data, firstName: e.target.value.toUpperCase() })}
                            placeholder="JUAN CARLOS"
                            className="w-full input-field py-4"
                        />
                    </div>
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
                                <MapPin className="w-4 h-4" />
                                Provincia *
                            </label>
                            <select
                                required
                                value={data.province}
                                onChange={(e) => setData({ ...data, province: e.target.value })}
                                className="w-full input-field"
                            >
                                <option value="" style={{ color: '#111', backgroundColor: '#fff' }}>Selecciona una provincia</option>
                                {ECUADOR_PROVINCES.map((province) => (
                                    <option key={province} value={province} style={{ color: '#111', backgroundColor: '#fff' }}>{province}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
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

                            <div>
                                <label className="block text-white/80 mb-2 font-medium flex items-center gap-2">
                                    <Hash className="w-4 h-4" />
                                    Código Postal *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={data.postalCode}
                                    onChange={(e) => setData({ ...data, postalCode: e.target.value })}
                                    placeholder="170150"
                                    className="w-full input-field"
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* For non-Ecuador countries */}
                {!isEcuador && data.country && (
                    <div className="grid md:grid-cols-2 gap-4">
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

                        <div>
                            <label className="block text-white/80 mb-2 font-medium flex items-center gap-2">
                                <Hash className="w-4 h-4" />
                                Código Postal
                            </label>
                            <input
                                type="text"
                                value={data.postalCode}
                                onChange={(e) => setData({ ...data, postalCode: e.target.value })}
                                placeholder="12345"
                                className="w-full input-field"
                            />
                        </div>
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
                        className="flex-1 py-4 bg-white text-black font-bold rounded-xl hover:shadow-lg hover:shadow-white/30 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                    >
                        Continuar al Pago
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </motion.div >
    );
}

// Payment Form - Payphone Only
function PaymentForm({ data, setData, onSubmit, onBack }: any) {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        setLoading(true);
        await onSubmit(e);
        // If onSubmit fails/throws, we might want to reset loading, but 
        // usually we redirect or show alert. 
        // In the main component, on error we should probably allow retry. 
        // For now let's rely on the parent to handle errors, but we can't easily reset loading here without a prop.
        // Actually, the parent `handlePaymentSubmit` is async. We can wrap it.
        setLoading(false);
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
                                Redirigiendo...
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
