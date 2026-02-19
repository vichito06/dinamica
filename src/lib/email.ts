import { prisma } from './prisma';
import { Resend } from 'resend';



interface SendTicketsParams {
    to: string;
    customerName: string;
    saleCode: string;
    tickets: string[];
    total?: number;
}

export async function sendTicketsEmail({
    to,
    customerName,
    saleCode,
    tickets,
    total
}: SendTicketsParams) {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM;

    if (!apiKey) {
        console.error('[Email] RESEND_API_KEY is missing');
        return { success: false, error: 'Misconfigured server: RESEND_API_KEY missing' };
    }
    if (!fromEmail) {
        console.error('[Email] EMAIL_FROM is missing');
        return { success: false, error: 'Misconfigured server: EMAIL_FROM missing' };
    }
    if (!to || !Array.isArray(tickets) || tickets.length === 0) {
        return { success: false, error: "Missing 'to' or 'tickets'" };
    }

    // Lazy initialization
    const resend = new Resend(apiKey);

    const safeName = customerName?.trim() || 'Cliente';
    const safeTotal = typeof total === 'number' ? total.toFixed(2) : null;

    const ticketListHtml = tickets.map(t =>
        `<span style="padding:6px 10px;border:1px solid #ddd;border-radius:10px;font-weight:bold;font-family:monospace;margin:2px;">${t}</span>`
    ).join('');

    const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.4;max-width:600px;margin:0 auto;color:#333;">
      <h2 style="color:#6d28d9;">🎟️ Tus números - Y Voss Oeee</h2>
      <p>Hola <b>${safeName}</b>, tu compra fue confirmada.</p>
      
      <div style="background:#f9fafb;padding:15px;border-radius:8px;margin:15px 0;">
        <p style="margin:5px 0;"><b>Compra:</b> #${saleCode}</p>
        ${safeTotal ? `<p style="margin:5px 0;"><b>Total:</b> $${safeTotal}</p>` : ''}
      </div>

      <h3 style="margin-top:20px;">Tus Números de la Suerte:</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">
        ${ticketListHtml}
      </div>

      <p style="margin-top:20px;font-size:12px;color:#666;">
        Gracias por participar 💜<br>
        Este es un correo automático, por favor no respondas.
      </p>
    </div>
    `;

    try {
        console.log(`[Email] Attempting to send to ${to} (Sale: #${saleCode})`);
        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to,
            subject: `🎟️ Tus Tickets de la Suerte - Compra #${saleCode}`,
            html: htmlContent,
        });

        if (error) {
            // Check for rate limit or other specific errors
            const isRateLimit = (error as any).statusCode === 429;
            console.error(`[Email] Resend error for Sale #${saleCode}:`, {
                name: error.name,
                message: error.message,
                isRateLimit
            });
            return {
                success: false,
                error: error.message,
                isRateLimit
            };
        }

        console.log(`[Email] Successfully sent to ${to} | Resend ID: ${data?.id}`);
        return { success: true, data };
    } catch (error: any) {
        console.error(`[Email] Critical crash sending email for Sale #${saleCode}:`, error);
        return {
            success: false,
            error: error.message || 'Unknown crash'
        };
    }
}

function normalizeNumbers(input: any): number[] {
    if (!input) return [];
    if (Array.isArray(input)) return input.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    if (typeof input === "string") {
        try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) return parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
        } catch { }
    }
    return [];
}

export async function sendSaleEmail(saleId: string) {
    const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
            customer: true,
            tickets: { select: { number: true }, orderBy: { number: "asc" } },
        },
    });

    if (!sale) {
        throw new Error("SALE_NOT_FOUND");
    }

    const email = sale.customer?.email;
    if (!email) {
        throw new Error("CUSTOMER_EMAIL_NOT_FOUND");
    }

    // Números: prioridad a tickets ligados; fallback a snapshot/solicitud
    const linked = sale.tickets?.map((t: { number: number }) => t.number) ?? [];
    const requested = normalizeNumbers(sale.ticketNumbers).length ? normalizeNumbers(sale.ticketNumbers) :
        (normalizeNumbers(sale.requestedNumbers).length ? normalizeNumbers(sale.requestedNumbers) : []);

    const numbers = (linked.length ? linked : requested).sort((a: number, b: number) => a - b);
    const ticketsFormatted = numbers.map((n: number) => String(n).padStart(4, "0"));

    const result = await sendTicketsEmail({
        to: email,
        customerName: `${sale.customer.firstName} ${sale.customer.lastName}`,
        saleCode: sale.clientTransactionId.slice(-6).toUpperCase(),
        tickets: ticketsFormatted,
        total: sale.amountCents / 100
    });

    if (result.success) {
        await prisma.sale.update({
            where: { id: saleId },
            data: { lastEmailSentAt: new Date(), lastError: null } as any
        });
    }

    return { ok: result.success, numbers: ticketsFormatted, error: result.error };
}
