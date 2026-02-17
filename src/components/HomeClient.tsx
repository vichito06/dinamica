'use client';

import { useState } from 'react';
import Hero from '@/components/Hero';
import NumberSelector from '@/components/NumberSelector';

interface HomeClientProps {
    settings: any;
}

export default function HomeClient({ settings }: HomeClientProps) {
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    return (
        <>
            <Hero
                raffleTitle={settings.raffleTitle}
                prizes={settings.prizes}
                onStartBuying={() => setIsSelectorOpen(true)}
            />

            {isSelectorOpen && (
                <NumberSelector
                    isOpen={isSelectorOpen}
                    onClose={() => setIsSelectorOpen(false)}
                />
            )}

            {/* Features Section - Separated box, more spacing */}
            <section className="py-32 textured-bg">
                <div className="container-custom">
                    <div className="section-box w-full">
                        <div className="text-center mb-12">
                            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                                ¿Cómo Funciona?
                            </h2>
                            <p className="text-lg text-gray-400">
                                Participar es fácil y seguro
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1200px] mx-auto" style={{ '--mobile-breakpoint': '900px' } as React.CSSProperties}>
                            <FeatureCard
                                title="Elige tus Números"
                                description="Selecciona tus números favoritos o genera números aleatorios."
                            />
                            <FeatureCard
                                title="Completa tus Datos"
                                description="Ingresa tu información personal y método de pago de forma segura."
                            />
                            <FeatureCard
                                title="Espera el Sorteo"
                                description="Participa automáticamente y espera a conocer a los ganadores."
                            />
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

interface FeatureCardProps {
    title: string;
    description: string;
}

function FeatureCard({ title, description }: FeatureCardProps) {
    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all duration-300 group cursor-pointer hover:scale-105" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
        </div>
    );
}
