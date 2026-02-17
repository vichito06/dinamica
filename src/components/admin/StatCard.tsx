import React from 'react';

type StatCardProps = {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    sub?: string;
};

export function StatCard({ title, value, icon, sub }: StatCardProps) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 shadow-lg hover:bg-white/10 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm text-white/70 font-medium">{title}</p>
                    <p className="mt-2 text-4xl font-bold text-white tracking-tight">{value}</p>
                    {sub ? <p className="mt-2 text-sm text-white/50">{sub}</p> : null}
                </div>
                {icon ? (
                    <div className="rounded-xl bg-white/10 p-3 text-white/90">
                        {icon}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
