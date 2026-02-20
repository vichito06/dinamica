const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const start = new Date('2026-02-20T01:30:00Z');
        const end = new Date('2026-02-20T02:00:00Z');

        const sales = await prisma.sale.findMany({
            where: {
                createdAt: {
                    gte: start,
                    lte: end
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                status: true,
                payphonePaymentId: true,
                payphoneStatusCode: true,
                clientTransactionId: true,
                createdAt: true,
                amountCents: true,
                lastError: true
            }
        });

        console.log(`Found ${sales.length} sales between 01:30 and 01:45 UTC`);
        sales.forEach(s => {
            console.log(`${s.createdAt.toISOString()} | id: ${s.id} | status: ${s.status} | pStat: ${s.payphoneStatusCode} | pId: ${s.payphonePaymentId} | amount: ${s.amountCents} | ctxId: ${s.clientTransactionId} | error: ${s.lastError || 'none'}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
