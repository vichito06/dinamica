"use client";

import { useEffect, useRef } from "react";

function getCookie(name: string) {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
}
function setCookie(name: string, value: string, days = 30) {
    if (typeof document === "undefined") return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax`;
}
function uuid() {
    // suficientemente único para analytics
    return "v_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

export default function LandingVisitTracker({
    raffleId,
    eventName = "LANDING_VISIT",
}: {
    raffleId: string;
    eventName?: string;
}) {
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        if (!raffleId) return;

        // 1) visitorId persistente (cookie)
        let visitorId = getCookie("yvo_visitor");
        if (!visitorId) {
            visitorId = uuid();
            setCookie("yvo_visitor", visitorId, 30);
        }

        // 2) 1 visita por sesión (sessionStorage)
        const ssKey = `yvo_lv_${raffleId}`;
        if (typeof sessionStorage !== "undefined") {
            if (sessionStorage.getItem(ssKey) === "1") return;
            sessionStorage.setItem(ssKey, "1");
        }

        const payload = {
            event: eventName,              // IMPORTANTE: EXACTO "LANDING_VISIT"
            path: typeof window !== "undefined" ? window.location.pathname || "/" : "/",
            raffleId,
            visitorId,
            ts: Date.now(),
            ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
        };

        const url = "/api/analytics/track";
        try {
            if (typeof navigator !== "undefined" && navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
                const ok = navigator.sendBeacon(url, blob);
                if (ok) return;
            }
        } catch { }

        // fallback
        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
        }).catch(() => { });
    }, [raffleId, eventName]);

    return null;
}
