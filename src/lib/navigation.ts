export const HARD_RELOAD_KEY = "__hard_reload__";

export function wasHardReload(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const v = sessionStorage.getItem(HARD_RELOAD_KEY) === "1";
        if (v) {
            sessionStorage.removeItem(HARD_RELOAD_KEY); // consume the flag
        }
        return v;
    } catch {
        return false;
    }
}

// Keep for legacy if needed, but we'll phase it out
export function isHardReload(): boolean {
    return wasHardReload();
}
