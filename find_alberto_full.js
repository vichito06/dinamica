const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const customers = await prisma.customer.findMany({
            where: {
                lastName: { contains: 'Avila', mode: 'insensitive' }
            },
            include: {
                sales: {
                    include: {
                        tickets: true
                    }
                }
            }
        });

        customers.forEach(c => {
            console.log(`CUSTOMER: ${c.firstName} ${c.lastName} | ID: ${c.id}`);
            c.sales.forEach(s => {
                console.log(`  SALE: ${s.id} | Status: ${s.status} | EmailAt: ${s.lastEmailSentAt}`);
                console.log(`  Tickets: ${s.tickets.map(t => t.number).join(', ')}`);
                console.log(`  RequestedNumbers: ${JSON.stringify(s.requestedNumbers)}`);
                console.log(`  TicketNumbers (json): ${JSON.stringify(s.ticketNumbers)}`);
            });
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
