"use client";

type Props = { sold: number; total: number; percent: number };

export default function SalesProgress({ sold, total, percent }: Props) {
    const safe = Math.min(100, Math.max(0, percent || 0));

    return (
        <div className="mt-8 w-full max-w-2xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 mb-1">
                <div className="text-sm font-medium text-white/80">Progreso de ventas</div>
                <div className="text-sm font-bold text-yellow-400">{safe.toFixed(1)}%</div>
            </div>

            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/10 border border-white/5">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(250,204,21,0.3)]"
                    style={{ width: `${safe}%` }}
                />
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-wider text-white/50 font-medium">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    <span>Vendidos: <span className="text-white font-bold">{sold.toLocaleString()}</span></span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                    <span>Total: <span className="text-white font-bold">{total.toLocaleString()}</span></span>
                </div>
            </div>
        </div>
    );
}
