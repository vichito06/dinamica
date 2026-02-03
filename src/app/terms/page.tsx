'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500/30 font-sans">
            {/* Simple Header */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
                <div className="container-custom py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="hover:opacity-80 transition-opacity">
                            <Image src="/logo.png" alt="Logo" width={40} height={40} />
                        </Link>
                        <h1 className="text-sm md:text-base font-bold text-white/90 hidden sm:block">
                            Y Voss Oeee — Dinámica 1
                        </h1>
                    </div>
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-full border border-white/10"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver al Inicio
                    </Link>
                </div>
            </div>

            {/* Content */}
            <main className="container-custom pt-32 pb-20 max-w-4xl">
                <div className="glass-strong p-8 md:p-12 rounded-3xl border border-white/10 space-y-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Términos y Condiciones</h2>
                        <p className="text-white/60">Última actualización: Febrero 2026</p>
                    </div>

                    <div className="space-y-8 text-white/80 leading-relaxed">
                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">1. Objeto de la dinámica</h3>
                            <p>
                                La presente dinámica consiste en la adquisición voluntaria de tickets numerados del 0001 al 9999 para participar por premios en efectivo, conforme a los valores y condiciones publicados en esta plataforma y en los canales oficiales de Y Voss Oeee.
                            </p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">2. Tickets disponibles y regla de no repetición</h3>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Los tickets disponibles van desde 0001 hasta 9999.</li>
                                <li>Cada ticket es único y no puede repetirse. Una vez comprado y confirmado, el número queda reservado para el participante y no podrá ser adquirido por otra persona.</li>
                                <li>La participación se considera válida únicamente cuando el sistema confirma el pago y el ticket queda registrado como confirmado.</li>
                                <li>En caso de alta demanda o intentos simultáneos, si un ticket seleccionado se encuentra ocupado, el usuario deberá seleccionar otro número disponible.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">3. Precio y confirmación de compra</h3>
                            <p className="mb-2">El precio por ticket se mostrará en la plataforma antes de finalizar la compra.</p>
                            <p className="mb-2">Al finalizar el proceso, el participante recibirá una confirmación y/o comprobante al correo registrado, donde constará el/los ticket(s) adquiridos.</p>
                            <p>Es responsabilidad del participante registrar correctamente sus datos personales (nombre completo, cédula, correo y teléfono), ya que serán utilizados para la validación y entrega del premio.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">4. Condición para realizar el sorteo</h3>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>El sorteo se realizará únicamente cuando se hayan vendido todos los tickets disponibles (del 0001 al 9999).</li>
                                <li>Una vez completada la venta total de tickets, se publicará la fecha y hora oficial del sorteo por los canales oficiales de Y Voss Oeee y/o por esta plataforma.</li>
                                <li>El participante acepta que, al formar parte de esta dinámica, su ticket ganador y/o parte de la información necesaria para validar (por ejemplo: nombre y número de ticket) pueda ser mencionada públicamente durante la transmisión del sorteo, respetando los límites de privacidad establecidos.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">5. Modalidad del sorteo y contacto del ganador</h3>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>El sorteo se realizará EN VIVO a través de los canales oficiales de Y Voss Oeee.</li>
                                <li>Durante la transmisión en vivo se procederá a llamar al ganador al número telefónico registrado en la compra.</li>
                                <li>Si el ganador no contesta, se realizarán hasta tres (3) intentos de llamada durante la transmisión.</li>
                                <li>Si luego de tres intentos no se logra contacto con el ganador, se procederá a realizar un nuevo sorteo en vivo, repitiendo el proceso hasta que exista un ganador que responda y pueda ser validado.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">6. Validación del ganador y requisitos para reclamar el premio</h3>
                            <p className="mb-2">Para reclamar el premio, el ganador deberá cumplir con todos los siguientes requisitos:</p>
                            <ul className="list-disc pl-5 space-y-2 mb-3">
                                <li>Presentar su cédula de identidad (documento oficial) para verificación.</li>
                                <li>Mostrar el número de ticket ganador, el cual debe coincidir con el registrado en el sistema y con el comprobante enviado al correo electrónico del participante.</li>
                                <li>Enviar la información solicitada dentro de un plazo máximo de tres (3) días contados desde el momento en que fue anunciado y contactado como ganador (o desde la comunicación oficial realizada por la organización).</li>
                            </ul>
                            <p className="mb-2">La organización podrá solicitar información adicional mínima necesaria para confirmar identidad y titularidad del ticket (por ejemplo: confirmación de correo, número de teléfono y/o comprobante).</p>
                            <p>Si el ganador no envía los datos dentro de los 3 días, o si se detecta inconsistencia, suplantación o falta de coincidencia entre ticket y titular, la organización podrá anular la entrega y proceder conforme a las reglas de la dinámica (incluyendo nuevo sorteo si corresponde).</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">7. Confirmación pública y entrega del premio</h3>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Una vez validado, el ganador deberá enviar un video de confirmación/agradecimiento indicando que recibió el premio y que la página sí cumple con lo ofrecido.</li>
                                <li>Con la validación completa y el video de confirmación, se procederá con la entrega del premio por el medio acordado (transferencia u otra modalidad indicada por la organización).</li>
                                <li>El premio se entregará en un plazo máximo de X días hábiles posteriores a la validación completa de identidad, ticket, datos y confirmación.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">8. Publicación de resultados</h3>
                            <p>Los resultados del sorteo serán anunciados en vivo y podrán ser publicados en canales oficiales y/o en esta plataforma. El participante acepta la publicación del número de ticket ganador y del anuncio del ganador, respetando la privacidad en la medida razonable.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">9. Reembolsos y cancelaciones</h3>
                            <p>Las compras de tickets son voluntarias y, por regla general, no son reembolsables, salvo casos excepcionales como pagos duplicados verificados o cancelación definitiva de la dinámica. En dichos casos, el reembolso se realizará por el mismo medio de pago, conforme a los procesos de validación.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">10. Prohibiciones y fraude</h3>
                            <p>Cualquier intento de fraude, manipulación del sistema, suplantación de identidad o entrega de datos falsos podrá resultar en la anulación de la participación y del derecho a reclamar el premio, sin responsabilidad para la organización.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">11. Responsabilidad</h3>
                            <p>La organización no se responsabiliza por fallas de conectividad del participante, datos erróneos ingresados por el usuario, ni problemas con servicios de terceros (por ejemplo, pasarelas de pago o telefonía). En caso de incidentes técnicos generales, se informará por los canales oficiales.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">12. Aceptación de términos</h3>
                            <p>La participación en la dinámica implica la aceptación total de estos términos y condiciones. La versión vigente será la publicada en esta plataforma.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">13. Contacto</h3>
                            <p>Para consultas o soporte, comunicarse al correo: <a href="mailto:yvoss_oeee2012@gmail.com" className="text-white hover:underline decoration-white/50">yvoss_oeee2012@gmail.com</a></p>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
