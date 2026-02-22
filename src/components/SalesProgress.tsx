"use client";

type Props = { percent: number };

export default function SalesProgress({ percent }: Props) {
    const safe = Math.min(100, Math.max(0, Number(percent) || 0));

    return (
        <div className="mt-4 flex justify-center">
            <div className="w-full max-w-md rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-white/70">Progreso</span>
                    <span className="text-xs font-semibold text-white">{safe.toFixed(1)}%</span>
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-yellow-400 transition-all duration-700"
                        style={{ width: `${safe}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
