
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
        const data = await resend.emails.send({
            from: fromEmail,
            to,
            subject: `Tus Tickets - Compra #${saleCode}`,
            html: htmlContent,
        });

        console.log(`[Email] Sent to ${to} | ID: ${data.data?.id}`);
        return { success: true, data };
    } catch (error) {
        console.error('[Email] Error sending email:', error);
        return { success: false, error: 'Email send failed' };
    }
}
