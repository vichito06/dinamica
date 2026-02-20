const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const customers = await prisma.customer.findMany({
            where: {
                OR: [
                    { firstName: { contains: 'Alberto', mode: 'insensitive' } },
                    { lastName: { contains: 'Avila', mode: 'insensitive' } }
                ]
            },
            include: {
                sales: {
                    orderBy: { createdAt: 'desc' },
                    include: { tickets: true }
                }
            }
        });

        if (customers.length === 0) {
            console.log('No customers found');
            return;
        }

        customers.forEach(c => {
            console.log(`Customer: ${c.firstName} ${c.lastName} (${c.email})`);
            c.sales.forEach(s => {
                console.log(`  Sale ID: ${s.id}`);
                console.log(`  Status: ${s.status}`);
                console.log(`  Email Sent: ${s.lastEmailSentAt}`);
                console.log(`  Last Error: ${s.lastError}`);
                console.log(`  Tickets: ${s.tickets.map(t => t.number).join(', ')}`);
                console.log('---');
            });
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
