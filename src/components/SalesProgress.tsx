"use client";

type Props = { percent: number };

export default function SalesProgress({ percent }: Props) {
    const safe = Math.min(100, Math.max(0, Number(percent) || 0));

    return (
        <div className="mt-8 mb-12 flex flex-col items-center">
            {/* Texto superior */}
            <h3 className="mb-4 text-center text-lg font-bold text-white uppercase tracking-tight">
                Números Vendidos: {safe.toFixed(2)}%
            </h3>

            {/* Contenedor de la barra */}
            <div className="relative h-10 w-full max-w-4xl overflow-hidden rounded-lg bg-gray-200/20 shadow-inner backdrop-blur-sm">
                {/* La barra azul con el efecto de movimiento */}
                <div
                    className="loading-stripes h-full rounded-lg bg-blue-600 shadow-lg transition-all duration-700 ease-out"
                    style={{ width: `${safe}%` }}
                />
            </div>

            {/* Texto inferior */}
            <p className="mt-6 max-w-3xl text-center text-sm leading-relaxed text-white/80">
                El sorteo se realizará una vez vendida la totalidad de los números, es decir, cuando la barra de progreso llegue al 100%.
            </p>
        </div>
    );
}
