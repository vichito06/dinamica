import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'analytics-data.json');

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

export function getAnalyticsData(): AnalyticsData {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initial = getInitialData();
            fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
            return initial;
        }
        const content = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        return getInitialData();
    }
}

export function incrementAnalytics(type: 'pageview' | 'unique') {
    const data = getAnalyticsData();
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

    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving analytics', e);
    }
}
