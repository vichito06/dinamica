const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const sales = await prisma.sale.findMany({
            where: {
                createdAt: { gte: hourAgo }
            },
            include: {
                customer: true,
                tickets: { select: { number: true, status: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`Found ${sales.length} sales in the last hour:`);
        sales.forEach(s => {
            const soldTickets = s.tickets.filter(t => t.status === 'SOLD').map(t => t.number);
            console.log(`SALE: ${s.id}`);
            console.log(`  Created: ${s.createdAt.toISOString()}`);
            console.log(`  Customer: ${s.customer?.firstName} ${s.customer?.lastName} (${s.customer?.email})`);
            console.log(`  Status: ${s.status}`);
            console.log(`  Email Sent: ${s.lastEmailSentAt ? s.lastEmailSentAt.toISOString() : 'NO'}`);
            console.log(`  Last Error: ${s.lastError || 'None'}`);
            console.log(`  Tickets Sold: [${soldTickets.join(', ')}]`);
            console.log('---');
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
