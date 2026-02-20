const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const saleId = 'cmlu8vb0d0003l404ojm83i6p'; // Verified full ID from earlier logs
    console.log(`Verifying sale ${saleId}...`);

    const sale = await prisma.sale.findUnique({
        where: { id: saleId }
    });

    if (!sale) {
        console.error('Sale not found');
        return;
    }

    const PAYPHONE_BASE_URL = (process.env.PAYPHONE_BASE_URL || "https://pay.payphonetodoesposible.com/api").trim().replace(/\/+$/, "");
    const PAYPHONE_TOKEN = (process.env.PAYPHONE_TOKEN || "").trim().replace(/^(bearer\s+|Bearer\s+)/i, "");

    if (!PAYPHONE_TOKEN) {
        console.error('Missing PAYPHONE_TOKEN');
        return;
    }

    // PayPhone often expects Number IDs for some endpoints, but V2 Confirm takes any if it's alphanumeric
    // We'll try to find it via V2/Confirm (simulated check) or maybe there's a status endpoint

    try {
        const response = await fetch(`${PAYPHONE_BASE_URL}/button/V2/Confirm`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYPHONE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: sale.payphonePaymentId,
                clientTxId: sale.clientTransactionId
            })
        });

        const data = await response.json();
        console.log('PayPhone Response:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Fetch error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
