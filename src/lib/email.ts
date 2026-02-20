import { prisma } from './prisma';
import { Resend } from 'resend';



interface SendTicketsParams {
    to: string;
    customerName: string;
    idNumber: string;
    saleCode: string; // The short code (usually last 6 chars)
    saleId: string;   // The full ID
    tickets: string[];
    total?: number;
    date?: Date;
}

export async function sendTicketsEmail({
    to,
    customerName,
    idNumber,
    saleCode,
    saleId,
    tickets,
    total,
    date
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
    const formattedDate = (date || new Date()).toLocaleString('es-EC', {
        timeZone: 'America/Guayaquil',
        dateStyle: 'long',
        timeStyle: 'short'
    });

    const ticketListHtml = tickets.map(t =>
        `<span style="display:inline-block;padding:8px 12px;border:2px solid #6d28d9;border-radius:12px;font-weight:bold;font-family:monospace;margin:4px;font-size:16px;color:#6d28d9;background:#f5f3ff;">${t}</span>`
    ).join('');

    const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;color:#333;border:1px solid #eee;border-radius:16px;overflow:hidden;">
      <div style="background:#6d28d9;padding:30px;text-align:center;color:white;">
        <h1 style="margin:0;font-size:24px;">🎟️ ¡Compra Confirmada!</h1>
        <p style="margin:10px 0 0;opacity:0.9;">Y Voss Oeee - Dinámica 1</p>
      </div>

      <div style="padding:30px;">
        <p>Hola <b>${safeName}</b>,</p>
        <p>Tus tickets han sido generados exitosamente. Aquí tienes los detalles de tu participación:</p>
        
        <div style="background:#f9fafb;padding:20px;border-radius:12px;margin:20px 0;border:1px solid #f1f5f9;">
          <table style="width:100%;font-size:14px;">
            <tr><td style="color:#64748b;padding-bottom:5px;">Nombre:</td><td style="font-weight:bold;padding-bottom:5px;">${safeName}</td></tr>
            <tr><td style="color:#64748b;padding-bottom:5px;">Identificación:</td><td style="font-weight:bold;padding-bottom:5px;">${idNumber}</td></tr>
            <tr><td style="color:#64748b;padding-bottom:5px;">Orden ID:</td><td style="font-weight:bold;padding-bottom:5px;font-family:monospace;">${saleId}</td></tr>
            <tr><td style="color:#64748b;padding-bottom:5px;">Código:</td><td style="font-weight:bold;padding-bottom:5px;color:#6d28d9;">#${saleCode}</td></tr>
            <tr><td style="color:#64748b;padding-bottom:5px;">Fecha:</td><td style="font-weight:bold;padding-bottom:5px;">${formattedDate}</td></tr>
            ${safeTotal ? `<tr><td style="color:#64748b;">Total Pagado:</td><td style="font-weight:bold;font-size:16px;color:#059669;">$${safeTotal}</td></tr>` : ''}
          </table>
        </div>

        <h3 style="margin:30px 0 15px;text-align:center;color:#1e293b;">Tus Números de la Suerte:</h3>
        <div style="text-align:center;margin-bottom:30px;">
          ${ticketListHtml}
        </div>

        <div style="background:#fff7ed;padding:15px;border-radius:12px;border:1px solid #ffedd5;font-size:13px;color:#9a3412;">
          <b>Nota Importante:</b> Este correo es tu comprobante oficial de participación. No es reembolsable. Los ganadores serán anunciados por nuestros canales oficiales.
        </div>

        <p style="margin-top:30px;font-size:12px;color:#64748b;text-align:center;">
          Gracias por participar y mucha suerte 💜<br>
          <span style="opacity:0.7;">Este es un mensaje automático, por favor no respondas.</span>
        </p>
      </div>
    </div>
    `;

    try {
        console.log(`[Email] Attempting to send to ${to} (Sale: #${saleCode})`);
        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to,
            subject: `🎟️ Tus Tickets - Sorteo Dinámica (#${saleCode})`,
            html: htmlContent,
        });

        if (error) {
            console.error(`[Email] Resend error for Sale #${saleId}:`, error);
            return { success: false, error: error.message };
        }

        console.log(`[Email] Successfully sent to ${to} | Resend ID: ${data?.id}`);
        return { success: true, data };
    } catch (error: any) {
        console.error(`[Email] Critical crash sending email:`, error);
        return { success: false, error: error.message };
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
        idNumber: sale.customer.idNumber,
        saleCode: sale.clientTransactionId.slice(-6).toUpperCase(),
        saleId: sale.id,
        tickets: ticketsFormatted,
        total: sale.amountCents / 100,
        date: sale.confirmedAt || sale.createdAt
    });

    if (result.success) {
        await prisma.sale.update({
            where: { id: saleId },
            data: {
                lastEmailSentAt: new Date(),
                lastError: null,
                // Also update ticketNumbers in DB if not already present
                ...(sale.ticketNumbers.length === 0 ? { ticketNumbers: ticketsFormatted } : {})
            } as any
        });
        console.log(`[Email] Success status updated in DB for sale ${saleId}`);
    } else {
        console.error(`[Email] Error sending to ${email}: ${result.error}`);
        await prisma.sale.update({
            where: { id: saleId },
            data: {
                lastError: `EMAIL_FAILED: ${result.error}`,
                lastErrorAt: new Date()
            } as any
        }).catch(() => { });
    }

    return { ok: result.success, numbers: ticketsFormatted, error: result.error };
}
