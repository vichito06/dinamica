const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const today = new Date('2026-02-19T05:00:00Z'); // Start of local day (approx)
        const sales = await prisma.sale.findMany({
            where: {
                createdAt: { gte: today },
                status: { in: ['PAID', 'PENDING'] }
            },
            include: {
                customer: true,
                tickets: true
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`Found ${sales.length} sales today:`);
        sales.forEach(s => {
            console.log(`SALE: ${s.id}`);
            console.log(`  CreatedAt: ${s.createdAt.toISOString()}`);
            console.log(`  Customer: ${s.customer?.firstName} ${s.customer?.lastName} (${s.customer?.email})`);
            console.log(`  Status: ${s.status}`);
            console.log(`  Email Sent: ${s.lastEmailSentAt ? 'YES' : 'NO'}`);
            console.log(`  Tickets: ${s.tickets.map(t => t.number).join(', ')}`);
            console.log(`  Error: ${s.lastError}`);
            console.log('---');
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
