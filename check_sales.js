const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const sales = await prisma.sale.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
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
        console.log('Last 10 sales:');
        sales.forEach(s => {
            console.log(`${s.createdAt.toISOString()} | id: ${s.id} | status: ${s.status} | pStat: ${s.payphoneStatusCode} | pId: ${s.payphonePaymentId} | amount: ${s.amountCents} | error: ${s.lastError || 'none'}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
