'use client';

import { motion } from 'framer-motion';
import { Sparkles, Trophy, DollarSign } from 'lucide-react';
import Image from 'next/image';

interface HeroProps {
    raffleTitle?: string;
    prizes?: { title: string, amount: string }[];
    onStartBuying?: () => void;
}

export default function Hero({ raffleTitle, prizes, onStartBuying }: HeroProps) {
    const displayPrizes = (prizes && prizes.length > 0) ? prizes : [
        { title: "1er Premio", amount: "$1000" },
        { title: "2do Premio", amount: "$300" },
        { title: "3er Premio", amount: "$100" }
    ];
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden textured-bg grid-pattern">
            {/* Subtle animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-20 w-72 h-72 bg-white/5 rounded-full blur-3xl animate-float"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/3 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="container-custom relative z-10 py-20">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center"
                >
                    {/* Logo */}
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className="mb-8 flex justify-center"
                    >
                        <div className="relative">
                            <Image
                                src="/logo.png"
                                alt="Y Voss Oeee Logo"
                                width={280}
                                height={280}
                                priority
                                className="drop-shadow-2xl"
                            />
                        </div>
                    </motion.div>

                    {/* Badge */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                        className="inline-flex items-center gap-2 px-6 py-3 mb-6 glass rounded-full border border-white/20"
                    >
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                        <span className="text-sm font-semibold text-white">Dinámica Oficial</span>
                    </motion.div>

                    {/* Main Title */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-5xl md:text-7xl font-bold mb-8 text-white"
                    >
                        {raffleTitle || "Dinámica 1"}
                    </motion.h1>

                    {/* Prizes Section - Flexbox container with custom spacing */}
                    <div className="prizes-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px' }}>
                        {/* Subtitle */}
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="text-2xl text-gray-300"
                        >
                            Compra números y participa por premios en efectivo
                        </motion.p>

                        {/* Price Highlight */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.7 }}
                        >
                            <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-gray-800 to-gray-900 border-2 border-white/30 rounded-2xl shadow-2xl">
                                <DollarSign className="w-8 h-8 text-yellow-400" />
                                <span className="text-3xl md:text-4xl font-bold text-white">1 por número</span>
                            </div>
                        </motion.div>

                        {/* Prize Cards with MORE SPACING */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            className="grid grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto"
                            style={{ gap: '48px', marginTop: '10px', marginBottom: '12px' }}
                        >
                            {displayPrizes.map((prize, index) => (
                                <PrizeCard
                                    key={index}
                                    icon={<Trophy className={`w-12 h-12 ${index === 0 ? 'text-yellow-500' : 'text-gray-300'}`} />}
                                    place={prize.title}
                                    amount={prize.amount}
                                    bgColor={index === 0 ? "bg-gradient-to-br from-yellow-500/20 to-yellow-600/10" : "bg-white/5"}
                                    borderColor={index === 0 ? "border-yellow-500/40" : "border-white/10"}
                                    delay={0.9 + (index * 0.1)}
                                />
                            ))}
                        </motion.div>

                        {/* CTA Button */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 1.2, type: 'spring', stiffness: 200 }}
                        >
                            <button
                                onClick={() => onStartBuying?.()}
                                className="group relative px-12 py-5 bg-white text-black text-xl font-bold rounded-full shadow-2xl hover:shadow-white/30 transition-all duration-300 hover:scale-110 border-2 border-white/50"
                            >
                                <span className="relative z-10 flex items-center gap-3">
                                    <DollarSign className="w-6 h-6" />
                                    Comprar Números Ahora
                                </span>
                            </button>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

interface PrizeCardProps {
    icon: React.ReactNode;
    place: string;
    amount: string;
    bgColor: string;
    borderColor: string;
    delay: number;
}

function PrizeCard({ icon, place, amount, bgColor, borderColor, delay }: PrizeCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            whileHover={{ scale: 1.08, y: -10 }}
            className={`${bgColor} ${borderColor} border-2 backdrop-blur-xl p-12 rounded-3xl transition-all duration-300 cursor-pointer group shadow-xl`}
        >
            <div className="flex justify-center mb-6 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <div className="text-gray-400 text-base font-medium mb-3">{place}</div>
            <div className="text-5xl font-bold text-white mb-2">{amount}</div>
            <div className="text-gray-500 text-sm">Premio en efectivo</div>
        </motion.div>
    );
}
