import Link from 'next/link';
import { ArrowLeft, Shield, Eye } from 'lucide-react';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen textured-bg py-20 px-4">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio
                </Link>

                <div className="glass-strong rounded-3xl border border-white/10 p-8 md:p-12">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                            <Shield className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-0">Protección de Datos</h1>
                    </div>

                    <div className="space-y-8 text-white/80 leading-relaxed">
                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">1. Datos Recopilados</h2>
                            <p>Recopilamos únicamente la información necesaria para gestionar tu participación en el sorteo y garantizar la entrega de premios:</p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>Nombre y Apellido</li>
                                <li>Cédula de Identidad (para verificación de ganador)</li>
                                <li>Correo electrónico (para envío de tickets)</li>
                                <li>Número de teléfono (para contacto en caso de ganar)</li>
                                <li>Ciudad y Provincia</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">2. Uso de la Información</h2>
                            <p>Tu información se utiliza exclusivamente para:</p>
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>Generar y certificar tus boletos.</li>
                                <li>Comunicarte si has resultado ganador.</li>
                                <li>Prevenir fraudes y duplicados en el sistema.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">3. Seguridad de Pagos</h2>
                            <p>No almacenamos datos de tarjetas de crédito o débito. Todos los pagos son procesados de forma segura a través de <b>PayPhone</b>, cumpliendo con los estándares internacionales PCI-DSS.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">4. Terceros</h2>
                            <p>Tus datos no serán vendidos ni compartidos con terceros para fines publicitarios. Solo compartimos la información necesaria con proveedores logísticos o financieros para la entrega de premios.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">5. Tus Derechos</h2>
                            <p>Puedes solicitar la corrección de tus datos o información sobre tu participación enviando un mensaje a nuestros canales oficiales con tu número de cédula.</p>
                        </section>
                    </div>

                    <div className="mt-12 pt-8 border-t border-white/10 text-center">
                        <p className="text-sm text-white/40 italic">Tu privacidad es nuestra prioridad 💜</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
