export function isHardReload(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        // "reload" = F5 / recargar navegador
        return nav?.type === "reload";
    } catch {
        return false;
    }
}
