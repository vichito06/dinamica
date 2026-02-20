const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const sales = await prisma.sale.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: true,
                tickets: { take: 5 }
            }
        });

        console.log('--- RECENT SALES EMAIL STATUS ---');
        sales.forEach(s => {
            console.log(`Sale ID: ${s.id}`);
            console.log(`Status: ${s.status}`);
            console.log(`Customer: ${s.customer?.firstName} ${s.customer?.lastName} (${s.customer?.email})`);
            console.log(`Email Sent: ${s.lastEmailSentAt ? 'YES at ' + s.lastEmailSentAt.toISOString() : 'NO'}`);
            console.log(`Last Error: ${s.lastError || 'None'}`);
            console.log(`Error At: ${s.lastErrorAt ? s.lastErrorAt.toISOString() : 'Never'}`);
            console.log(`Created At: ${s.createdAt.toISOString()}`);
            console.log('---------------------------');
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
