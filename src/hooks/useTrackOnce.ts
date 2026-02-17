import { useEffect, useRef } from "react";

/**
 * Hook to ensure a function runs only once per component mount (or per load).
 * Useful for analytics tracking and other side effects that should not repeat.
 */
export function useTrackOnce(fn: () => void) {
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        fn();
    }, [fn]);
}
