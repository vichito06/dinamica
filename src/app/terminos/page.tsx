import Link from 'next/link';
import { ArrowLeft, Shield, FileText } from 'lucide-react';

export default function TermsPage() {
    return (
        <div className="min-h-screen textured-bg py-20 px-4">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio
                </Link>

                <div className="glass-strong rounded-3xl border border-white/10 p-8 md:p-12">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-purple-600/20 flex items-center justify-center border border-purple-500/30">
                            <FileText className="w-6 h-6 text-purple-400" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-0">Términos y Condiciones</h1>
                    </div>

                    <div className="space-y-8 text-white/80 leading-relaxed">
                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">1. Introducción</h2>
                            <p>Bienvenido a <b>Y Voss Oeee - Dinámica 1</b>. Al participar en nuestro sorteo, aceptas cumplir con los presentes términos y condiciones. Por favor, léelos atentamente antes de realizar tu compra.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">2. Elegibilidad</h2>
                            <p>Para participar, debes ser mayor de 18 años y residir en territorio ecuatoriano (o tener una cuenta bancaria nacional para la entrega de premios). Los empleados directos de la organización no podrán participar.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">3. Mecánica del Sorteo</h2>
                            <p>Cada número tiene un costo de $1.00 USD. Los números se asignan de forma única al momento del pago. El sorteo se realizará a través de nuestros canales oficiales una vez se complete la meta de ventas o en la fecha establecida en nuestras redes sociales.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">4. Premios</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><b>Primer Premio:</b> $1,000.00 USD</li>
                                <li><b>Segundo Premio:</b> $300.00 USD</li>
                                <li><b>Tercer Premio:</b> $100.00 USD</li>
                            </ul>
                            <p className="mt-4">Los premios serán entregados mediante transferencia bancaria tras la verificación de la identidad del ganador.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">5. Reembolsos</h2>
                            <p><b>Importante:</b> Todas las ventas de boletos son finales. No se realizan reembolsos bajo ninguna circunstancia, excepto en caso de cancelación total del sorteo por parte de la organización.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-4">6. Contacto</h2>
                            <p>Para cualquier duda o soporte técnico, puedes contactarnos a través de nuestra cuenta oficial de Instagram o mediante el correo de contacto proporcionado al realizar tu compra.</p>
                        </section>
                    </div>

                    <div className="mt-12 pt-8 border-t border-white/10 text-center">
                        <p className="text-sm text-white/40 italic">Última actualización: 18 de febrero, 2026</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
