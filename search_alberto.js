const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const sales = await prisma.sale.findMany({
            include: {
                customer: true,
                tickets: true
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        console.log('--- RECENT SALES DEBUG ---');
        sales.forEach(s => {
            const name = `${s.customer?.firstName} ${s.customer?.lastName}`.toUpperCase();
            if (name.includes('ALBERTO') || name.includes('AVILA')) {
                console.log(`FOUND SALE: ${s.id}`);
                console.log(`  Name: ${name}`);
                console.log(`  Status: ${s.status}`);
                console.log(`  Email: ${s.customer?.email}`);
                console.log(`  Sent: ${s.lastEmailSentAt}`);
                console.log(`  Error: ${s.lastError}`);
                console.log(`  Tickets: ${s.tickets.map(t => t.number).join(', ')}`);
                console.log(`  Requested: ${s.requestedNumbers.join(', ')}`);
            }
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
