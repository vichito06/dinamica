const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const c = await prisma.customer.findFirst({
            where: { firstName: { contains: 'Carlos', mode: 'insensitive' }, lastName: { contains: 'Avila', mode: 'insensitive' } }
        });
        if (c) {
            console.log(`FullName: ${c.firstName} ${c.lastName}`);
            console.log(`Email: "${c.email}"`);
            console.log(`Email Length: ${c.email?.length}`);
        } else {
            console.log('Carlos Avila not found');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
