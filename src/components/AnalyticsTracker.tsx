'use client';

import { useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useTrackOnce } from '@/hooks/useTrackOnce';

export default function AnalyticsTracker() {
    const pathname = usePathname();

    const trackVisit = useCallback(async () => {
        if (pathname.startsWith('/admin')) return; // Don't track admin pages

        try {
            // 1. Always track pageview
            await fetch('/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'pageview' })
            });

            // 2. Track unique visitor
            const today = new Date().toISOString().split('T')[0];
            const lastVisit = localStorage.getItem('analytics_last_visit');

            if (lastVisit !== today) {
                await fetch('/api/analytics/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'unique' })
                });
                localStorage.setItem('analytics_last_visit', today);
            }
        } catch (error) {
            console.error('Analytics error:', error);
        }
    }, [pathname]);

    useTrackOnce(trackVisit);

    return null;
}
