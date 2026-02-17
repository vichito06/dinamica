import prisma from '@/lib/prisma';

interface AnalyticsData {
    total_pageviews: number;
    total_unique: number;
    daily_stats: Record<string, { pageviews: number; unique: number }>;
}

const getInitialData = (): AnalyticsData => ({
    total_pageviews: 0,
    total_unique: 0,
    daily_stats: {}
});

export async function getAnalyticsData(): Promise<AnalyticsData> {
    try {
        const record = await prisma.analytics.findUnique({ where: { id: 1 } });
        if (!record) {
            const initial = getInitialData();
            // Try to init if possible
            try {
                await prisma.analytics.create({
                    data: { id: 1, data: initial as any }
                });
            } catch (e) { }
            return initial;
        }
        return record.data as unknown as AnalyticsData;
    } catch (error) {
        return getInitialData();
    }
}

export async function incrementAnalytics(type: string, path?: string, sessionId?: string) {
    try {
        const data = await getAnalyticsData();
        const today = new Date().toISOString().split('T')[0];

        if (!data.daily_stats[today]) {
            data.daily_stats[today] = { pageviews: 0, unique: 0 };
        }

        if (type === 'pageview') {
            data.total_pageviews++;
            data.daily_stats[today].pageviews++;
        } else if (type === 'unique') {
            data.total_unique++;
            data.daily_stats[today].unique++;
        }

        // Save legacy summary and granular event in parallel/sequence
        await Promise.all([
            prisma.analytics.upsert({
                where: { id: 1 },
                create: { id: 1, data: data as any },
                update: { data: data as any }
            }),
            prisma.analyticsEvent.create({
                data: {
                    type,
                    path: path || null,
                    sessionId: sessionId || null
                }
            })
        ]);

    } catch (e) {
        console.error('Error saving analytics', e);
    }
}
