const { PrismaClient } = require('@prisma/client');
const { confirmPayphonePayment } = require('./src/lib/payphoneConfirm');
// Since I can't easily import TS files directly into node without setup, 
// I'll manually check the status with PayPhone using the utility logic.

const prisma = new PrismaClient();

async function run() {
    const saleId = 'cmlu86tzp000dl804j8ibfks9';
    console.log(`Checking sale ${saleId}...`);

    const sale = await prisma.sale.findUnique({
        where: { id: saleId }
    });

    if (!sale) {
        console.error('Sale not found');
        return;
    }

    console.log(`PayPhone ID: ${sale.payphonePaymentId}`);
    console.log(`ClientTxId: ${sale.clientTransactionId}`);

    // Directly try to confirm using the library logic (which I already fixed)
    // Wait, I can't easily require the TS file directly in some environments.
    // I'll just check the DB and maybe use fetch.

    const PAYPHONE_BASE_URL = (process.env.PAYPHONE_BASE_URL || "https://pay.payphonetodoesposible.com/api").trim().replace(/\/+$/, "");
    const PAYPHONE_TOKEN = (process.env.PAYPHONE_TOKEN || "").trim().replace(/^(bearer\s+|Bearer\s+)/i, "");

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

        if (data.statusCode === 3) {
            console.log('SUCCESS! Transaction is APPROVED.');
        } else {
            console.log(`Status is ${data.statusCode}. Not approved yet.`);
        }

    } catch (err) {
        console.error('Fetch error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
