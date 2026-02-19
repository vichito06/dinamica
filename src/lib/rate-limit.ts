import { prisma } from './prisma';

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    reset: Date;
}

/**
 * Basic rate limiter using Prisma to handle serverless state.
 * @param key Unique key for the action (e.g., "track:ip" or "reserve:sessionId")
 * @param limit Max points allowed in the window
 * @param windowSeconds Duration of the window in seconds
 */
export async function rateLimit(
    key: string,
    limit: number,
    windowSeconds: number
): Promise<RateLimitResult> {
    const now = new Date();
    const expireAt = new Date(now.getTime() + windowSeconds * 1000);

    try {
        const record = await prisma.rateLimit.upsert({
            where: { key },
            create: {
                key,
                points: 1,
                expireAt: expireAt
            },
            update: {}
        });

        // If the window has expired, reset points
        if (record.expireAt < now) {
            const resetRecord = await prisma.rateLimit.update({
                where: { key },
                data: {
                    points: 1,
                    expireAt: expireAt
                }
            });
            return {
                success: true,
                remaining: limit - 1,
                reset: expireAt
            };
        }

        // Increment points
        const updated = await prisma.rateLimit.update({
            where: { key },
            data: {
                points: { increment: 1 }
            }
        });

        const success = updated.points <= limit;
        return {
            success,
            remaining: Math.max(0, limit - updated.points),
            reset: updated.expireAt
        };
    } catch (error) {
        console.error('[RateLimit] Error:', error);
        // Fallback to allow (fail-open for UX)
        return { success: true, remaining: 1, reset: now };
    }
}
