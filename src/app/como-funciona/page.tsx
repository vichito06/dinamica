import Link from 'next/link';
import { ArrowLeft, Sparkles, Trophy, MousePointer2, CreditCard, Mail } from 'lucide-react';

export default function GuidePage() {
    return (
        <div className="min-h-screen textured-bg py-20 px-4">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio
                </Link>

                <div className="glass-strong rounded-3xl border border-white/10 p-8 md:p-12">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-yellow-600/20 flex items-center justify-center border border-yellow-500/30">
                            <Sparkles className="w-6 h-6 text-yellow-400" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-0">¿Cómo Participar?</h1>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 mb-12">
                        <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
                            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold mb-4">1</div>
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <MousePointer2 className="w-5 h-5" /> Escoge tus números
                            </h3>
                            <p className="text-white/60 text-sm">Selecciona tus números de la suerte manualmente o deja que el sistema los elija por ti de forma aleatoria.</p>
                        </div>

                        <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
                            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold mb-4">2</div>
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <CreditCard className="w-5 h-5" /> Realiza el pago
                            </h3>
                            <p className="text-white/60 text-sm">Completa tus datos personales y paga de forma segura con tu tarjeta preferida mediante nuestra pasarela PayPhone.</p>
                        </div>

                        <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
                            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold mb-4">3</div>
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <Mail className="w-5 h-5" /> Recibe tus tickets
                            </h3>
                            <p className="text-white/60 text-sm">Automáticamente recibirás un correo con tus números oficiales y el comprobante de tu participación.</p>
                        </div>

                        <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
                            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold mb-4">4</div>
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-yellow-500" /> ¡Gana y celebra!
                            </h3>
                            <p className="text-white/60 text-sm">Estate atento a nuestras transmisiones en vivo para conocer a los ganadores. ¡Tú podrías ser el próximo!</p>
                        </div>
                    </div>

                    <div className="space-y-6 text-white/80 leading-relaxed bg-black/20 p-8 rounded-2xl border border-white/10">
                        <h2 className="text-2xl font-bold text-white mb-2">Transparencia y Selección</h2>
                        <p>El sorteo se realiza utilizando bolilleros electrónicos o tómbolas físicas (dependiendo de la dinámica) transmitidas en vivo por Instagram y Facebook.</p>
                        <p>Cada número es único y no puede haber duplicados. El sistema bloquea los números seleccionados en tiempo real para garantizar que solo tú tengas tus números de la suerte.</p>
                        <p className="text-purple-400 font-medium">¡Gracias por confiar en Y Voss Oeee! Mucha suerte.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
