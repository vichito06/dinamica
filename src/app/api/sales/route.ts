import { NextResponse } from 'next/server';
import { confirmSale, getSales, getSalesSearch } from '@/lib/json-db';
import { sendTicketsEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || undefined;

    const sales = await getSalesSearch(q);
    return NextResponse.json(sales);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('[API POST /sales] Payload received:', JSON.stringify(body, null, 2));
        const { personalData, tickets, total, sessionId } = body;

        // Validation
        if (!tickets || tickets.length === 0) {
            return NextResponse.json({ error: 'No tickets selected' }, { status: 400 });
        }

        if (!sessionId) {
            return NextResponse.json({ error: 'Session ID missing' }, { status: 400 });
        }

        // Process Sale (Confirm Reservation)
        const sale = await confirmSale(
            {
                firstName: personalData.firstName || '',
                lastName: personalData.lastName || '',
                fullName: personalData.name || `${personalData.lastName} ${personalData.firstName}`.trim(),
                email: personalData.email,
                idNumber: personalData.idNumber || '',
                phone: personalData.phone || '',
                country: personalData.country || 'Ecuador',
                province: personalData.province || '',
                city: personalData.city || '',
                postalCode: personalData.postalCode || ''
            },
            tickets.map((t: number) => t.toString().padStart(4, '0')), // Ensure ID format
            total,
            sessionId
        );

        // Send Email Async (Fire and forget, but log error)
        try {
            // Check for idempotency
            // We need to re-fetch the sale to be sure (though confirmSale returns it, best practice is to check fresh state if we were in a separate process, but here we can trust 'sale' from confirmSale for initial check, but let's be safe and use usage of updateSale to lock)

            // In our JSON-DB, confirmSale just returned the object. 
            // We will verify if email was already sent (unlikely in this same request, but good for retries if we had them)
            if (sale.emailSentAt || sale.emailStatus === 'sent') {
                console.log(`[API POST /sales] Email already sent for sale ${sale.id}`);
            } else {
                // 1. Mark as pending (optional but good for concurrency if we had it)
                const { updateSale } = await import('@/lib/json-db'); // Import dynamically to avoid circular dep if any, or just standard import
                await updateSale(sale.id, { emailStatus: 'pending' });

                // 2. Prepare data
                const ticketsFormatted = sale.tickets.map((t: any) => String(t).padStart(4, '0'));

                // 3. Send
                const result = await sendTicketsEmail({
                    to: sale.customer.email,
                    customerName: sale.customer.fullName,
                    saleCode: String(sale.id),
                    tickets: ticketsFormatted,
                    total: Number(sale.total)
                });

                // 4. Persist result
                if (result.success) {
                    await updateSale(sale.id, {
                        emailStatus: 'sent',
                        emailSentAt: new Date().toISOString(),
                        emailMessageId: (result.data as any)?.id // Cast to any to avoid type error
                    });
                    console.log(`[API POST /sales] Email sent to ${sale.customer.email}`);
                } else {
                    await updateSale(sale.id, {
                        emailStatus: 'failed',
                        emailLastError: String(result.error || 'Unknown error')
                    });
                    console.error('[API POST /sales] Email sending failed:', result.error);
                }
            }
        } catch (emailError) {
            console.error('[API POST /sales] Email sending logic failed:', emailError);
            // We do NOT fail the request because the sale is already confirmed in DB
        }

        return NextResponse.json({ success: true, sale });

    } catch (error: any) {
        if (error.message && error.message.includes('no están disponibles')) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }

        console.error('Sale error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
