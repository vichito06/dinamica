"use client";
import { useEffect } from "react";
import { HARD_RELOAD_KEY } from "@/lib/navigation";

export function HardReloadMarker() {
    useEffect(() => {
        const mark = () => {
            try {
                sessionStorage.setItem(HARD_RELOAD_KEY, "1");
            } catch (e) {
                console.error("[HardReloadMarker] Failed to set flag", e);
            }
        };

        // Use beforeunload to mark as a potential reload/navigation away
        window.addEventListener("beforeunload", mark);
        return () => window.removeEventListener("beforeunload", mark);
    }, []);

    return null;
}
