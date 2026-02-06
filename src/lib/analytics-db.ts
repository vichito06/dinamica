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

export async function incrementAnalytics(type: 'pageview' | 'unique') {
    // We use a transaction or just simple update since metrics approximate is fine
    // But for unique logic, read-modify-write is safer.
    // Given low frequency (assumed), read-modify-write is okay.
    // Better: upsert pattern.

    // We need to read first to update complex JSON structure (daily_stats key).
    // Prisma JSON set path support is limited.
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

        await prisma.analytics.upsert({
            where: { id: 1 },
            create: { id: 1, data: data as any },
            update: { data: data as any }
        });

    } catch (e) {
        console.error('Error saving analytics', e);
    }
}
