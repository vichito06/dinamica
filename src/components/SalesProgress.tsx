"use client";

type Props = { percent: number };

export default function SalesProgress({ percent }: Props) {
    const safe = Math.min(100, Math.max(0, Number(percent) || 0));

    return (
        <div className="mt-6 w-full max-w-2xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
                <span className="text-sm text-white/80">Progreso de ventas</span>
                <span className="text-sm font-semibold text-white">{safe.toFixed(1)}%</span>
            </div>

            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                    className="h-full rounded-full bg-yellow-400 transition-all duration-700"
                    style={{ width: `${safe}%` }}
                />
            </div>
        </div>
    );
}
