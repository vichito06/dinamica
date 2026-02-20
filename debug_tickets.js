const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const tickets = await prisma.ticket.findMany({
            where: {
                status: 'SOLD',
                soldAt: { gte: hourAgo }
            },
            include: {
                sale: {
                    include: {
                        customer: true
                    }
                }
            },
            orderBy: { soldAt: 'desc' }
        });

        console.log(`Found ${tickets.length} tickets sold in the last hour:`);
        tickets.forEach(t => {
            console.log(`TICKET: ${t.number} | SoldAt: ${t.soldAt.toISOString()}`);
            console.log(`  Sale ID: ${t.sale?.id}`);
            console.log(`  Customer: ${t.sale?.customer?.firstName} ${t.sale?.customer?.lastName} (${t.sale?.customer?.email})`);
            console.log(`  Email Sent At: ${t.sale?.lastEmailSentAt ? t.sale.lastEmailSentAt.toISOString() : 'NO'}`);
            console.log(`  Sale Status: ${t.sale?.status}`);
            console.log('---');
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
