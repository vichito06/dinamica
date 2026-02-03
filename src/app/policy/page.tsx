'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

export default function PolicyPage() {
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
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Política de Privacidad</h2>
                        <p className="text-white/60">Última actualización: Febrero 2026</p>
                    </div>

                    <div className="space-y-8 text-white/80 leading-relaxed">
                        <p>
                            La presente Política de Privacidad describe cómo Y Voss Oeee (en adelante, “la Organización”) recopila, utiliza, almacena y protege los datos personales de los usuarios que participan en la dinámica “Y Voss Oeee — Dinámica 1” mediante esta plataforma.
                        </p>
                        <p className="border-l-4 border-white/20 pl-4 italic">
                            Al utilizar el sitio web y/o participar en la dinámica, el usuario acepta los términos de esta Política de Privacidad.
                        </p>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">1. Responsable del tratamiento</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Responsable:</strong> Y Voss Oeee</li>
                                <li><strong>Correo de contacto:</strong> <a href="mailto:yvoss_oeee2012@gmail.com" className="hover:text-white underline decoration-white/30">yvoss_oeee2012@gmail.com</a></li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">2. Datos personales que recopilamos</h3>
                            <p className="mb-4">Podemos recopilar los siguientes datos, según la etapa de participación:</p>

                            <h4 className="font-bold text-white mb-2">2.1. Datos de identificación y contacto</h4>
                            <ul className="list-disc pl-5 space-y-1 mb-4">
                                <li>Nombre completo</li>
                                <li>Número de cédula/ID</li>
                                <li>Correo electrónico</li>
                                <li>Número de teléfono</li>
                                <li>País, provincia, cantón/ciudad y código postal (si aplica)</li>
                            </ul>

                            <h4 className="font-bold text-white mb-2">2.2. Datos de la compra y participación</h4>
                            <ul className="list-disc pl-5 space-y-1 mb-4">
                                <li>Ticket(s) adquiridos (números de 0001 a 9999)</li>
                                <li>Fecha y hora de compra</li>
                                <li>Total pagado</li>
                                <li>Estado de compra (pendiente, confirmado, etc.)</li>
                                <li>Identificador interno de la transacción/venta (si aplica)</li>
                            </ul>

                            <h4 className="font-bold text-white mb-2">2.3. Datos del proceso de premiación</h4>
                            <p className="mb-2">En caso de resultar ganador, se podrá solicitar:</p>
                            <ul className="list-disc pl-5 space-y-1 mb-4">
                                <li>Verificación de identidad (por ejemplo, imagen/foto de la cédula mostrada para validación)</li>
                                <li>Confirmación del ticket ganador recibido por correo</li>
                                <li>Video de confirmación/agradecimiento (según los Términos y Condiciones)</li>
                            </ul>

                            <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-sm">
                                <strong>Importante:</strong> No solicitamos información financiera sensible por mensajes (por ejemplo, claves, contraseñas o códigos de seguridad). Los pagos se gestionan por los canales/servicios definidos para la dinámica.
                            </div>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">3. Finalidades del tratamiento (¿Para qué usamos tus datos?)</h3>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Procesar la compra de tickets y registrar correctamente la participación.</li>
                                <li>Enviar confirmaciones y notificaciones al correo proporcionado (incluyendo el/los números de ticket).</li>
                                <li>Garantizar la unicidad de tickets (evitar números repetidos) y prevenir fraude.</li>
                                <li>Realizar el sorteo y validar al ganador, incluyendo el contacto telefónico durante la transmisión en vivo.</li>
                                <li>Entregar el premio y cumplir con requisitos de verificación de identidad.</li>
                                <li>Atender consultas y soporte técnico.</li>
                                <li>Mejorar la experiencia del sitio, incluyendo métricas de visitas (analytics) de forma agregada.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">4. Base legal / consentimiento</h3>
                            <p className="mb-2">El tratamiento se sustenta en:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>La ejecución de la dinámica y los Términos y Condiciones aceptados por el usuario al participar.</li>
                                <li>El consentimiento del usuario al proporcionar datos para participar.</li>
                                <li>La necesidad de prevenir fraude y garantizar transparencia en la dinámica.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">5. Compartición de datos con terceros</h3>
                            <p className="mb-3">La Organización podrá compartir datos solo cuando sea necesario para:</p>
                            <ul className="list-disc pl-5 space-y-2 mb-4">
                                <li>Procesamiento de pagos (pasarelas o proveedores relacionados)</li>
                                <li>Servicios tecnológicos de hosting/servidores/almacenamiento (proveedores que soportan la plataforma)</li>
                                <li>Cumplimiento legal ante autoridades competentes si fuese requerido</li>
                            </ul>
                            <p>No vendemos datos personales ni los compartimos con fines comerciales ajenos a la dinámica.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">6. Publicidad del ganador y datos en transmisiones</h3>
                            <p className="mb-2">La dinámica incluye sorteos en vivo. Por ello:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>El usuario acepta que, si resulta ganador, se pueda anunciar públicamente el resultado (por ejemplo: nombre del ganador y número de ticket ganador), respetando criterios razonables de privacidad.</li>
                                <li>La Organización procurará no exponer datos sensibles (como número completo de cédula) durante la transmisión.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">7. Seguridad y protección de datos</h3>
                            <p className="mb-3">Aplicamos medidas razonables de seguridad para proteger la información, tales como:</p>
                            <ul className="list-disc pl-5 space-y-2 mb-4">
                                <li>Control de acceso a la administración</li>
                                <li>Validaciones para evitar duplicidad de tickets</li>
                                <li>Protección y almacenamiento seguro en servicios tecnológicos confiables</li>
                                <li>Buenas prácticas para evitar accesos no autorizados</li>
                            </ul>
                            <p>Aun así, el usuario reconoce que ningún sistema es 100% invulnerable y acepta usar la plataforma bajo su propia responsabilidad tecnológica.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">8. Tiempo de conservación</h3>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Mientras dure la dinámica y el proceso de sorteos/premios.</li>
                                <li>Posteriormente, por un período razonable para auditoría, soporte y cumplimiento, o por el tiempo requerido por obligaciones legales aplicables.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">9. Derechos del usuario (acceso, corrección, eliminación)</h3>
                            <ul className="list-disc pl-5 space-y-2 mb-4">
                                <li>Acceso a sus datos</li>
                                <li>Corrección de datos inexactos</li>
                                <li>Eliminación de datos (cuando sea procedente y no impida la gestión de la dinámica, obligaciones legales o auditoría)</li>
                            </ul>
                            <p className="mb-2">Para ejercer estos derechos, escribir a: <a href="mailto:yvoss_oeee2012@gmail.com" className="text-white hover:underline">yvoss_oeee2012@gmail.com</a></p>
                            <p>La Organización podrá solicitar verificación de identidad antes de procesar la solicitud.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">10. Cookies y analítica (visitas)</h3>
                            <ul className="list-disc pl-5 space-y-2 mb-4">
                                <li>La plataforma puede utilizar cookies o tecnologías similares para:</li>
                                <li>Funciones básicas del sitio</li>
                                <li>Medición de visitas y rendimiento (por ejemplo “visitas hoy”), de forma agregada</li>
                            </ul>
                            <p>El usuario puede ajustar cookies desde su navegador; algunas funciones podrían verse afectadas si se bloquean.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">11. Menores de edad</h3>
                            <p>La participación está dirigida a personas con capacidad legal para realizar transacciones. Si un menor participa, se entenderá que lo hace con autorización de su representante legal, según corresponda.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">12. Cambios en la política</h3>
                            <p>La Organización puede actualizar esta política. La versión vigente será la publicada en esta página con su fecha de actualización.</p>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-3">13. Contacto</h3>
                            <p>Para consultas sobre privacidad o solicitudes relacionadas con datos personales: <a href="mailto:yvoss_oeee2012@gmail.com" className="text-white hover:underline decoration-white/50">yvoss_oeee2012@gmail.com</a></p>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
