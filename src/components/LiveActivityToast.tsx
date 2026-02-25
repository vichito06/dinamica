"use client";

import React, { useState, useEffect } from "react";

interface LiveSale {
    name: string;
    city: string;
    count: number;
}

export default function LiveActivityToast() {
    const [sales, setSales] = useState<LiveSale[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // 1. Fetch data ONCE on mount
        const fetchSales = async () => {
            try {
                const res = await fetch("/api/sales/live");
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setSales(data);
                }
            } catch (err) {
                console.error("Failed to fetch live activity", err);
            }
        };
        fetchSales();
    }, []);

    useEffect(() => {
        if (sales.length === 0) return;

        let timer: NodeJS.Timeout;

        // Sequence: Initial delay -> Rotation loop
        const startSequence = () => {
            // Wait 15s for the first one
            timer = setTimeout(() => {
                showNext(0);
            }, 15000);
        };

        const showNext = (index: number) => {
            setCurrentIndex(index);
            setIsVisible(true);

            // Toast lasts 5 seconds
            setTimeout(() => {
                setIsVisible(false);

                // Wait 25 seconds before showing the next one
                timer = setTimeout(() => {
                    showNext((index + 1) % sales.length);
                }, 25000);
            }, 5000);
        };

        startSequence();

        return () => clearTimeout(timer);
    }, [sales]);

    if (currentIndex === -1 || sales.length === 0) return null;

    const currentSale = sales[currentIndex];

    return (
        <div
            className={`fixed z-[100] transition-all duration-700 ease-in-out px-4 py-3 
                ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"}
                /* Responsive position */
                bottom-6 left-6 
                max-md:left-1/2 max-md:-translate-x-1/2 max-md:w-[90%] max-md:max-w-sm
                /* Style */
                bg-[rgba(20,20,20,0.85)] backdrop-blur-md
                border border-white/10 rounded-2xl shadow-2xl
                flex items-center gap-3
            `}
        >
            <div className="flex-shrink-0 bg-blue-600/20 w-10 h-10 rounded-full flex items-center justify-center border border-blue-500/30">
                <span className="text-xl">🔥</span>
            </div>
            <div className="flex flex-col">
                <p className="text-white text-sm font-medium leading-tight">
                    <span className="text-blue-400 font-bold">{currentSale.name}</span> de {currentSale.city}
                </p>
                <p className="text-white/70 text-xs mt-0.5">
                    acaba de <span className="text-white">asegurar {currentSale.count} números</span>
                </p>
            </div>
        </div>
    );
}
