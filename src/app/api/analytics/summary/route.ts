import { NextResponse } from 'next/server';
import { getAnalyticsData } from '@/lib/analytics-db';

export async function GET(request: Request) {
    const data = await getAnalyticsData();
    const today = new Date().toISOString().split('T')[0];

    // Get stats for today, or 0 if none
    const todayStats = data.daily_stats[today] || { pageviews: 0, unique: 0 };

    return NextResponse.json({
        total_pageviews: data.total_pageviews,
        total_unique: data.total_unique,
        today: todayStats
    });
}
