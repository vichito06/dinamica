const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const sales = await prisma.sale.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: { customer: true }
        });

        console.log(`Found ${sales.length} recent sales:`);
        sales.forEach(s => {
            console.log(`ID: "${s.id}" | Status: ${s.status} | Customer: ${s.customer?.firstName} ${s.customer?.lastName} | Created: ${s.createdAt.toISOString()}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
