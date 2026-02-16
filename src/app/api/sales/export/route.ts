import { NextRequest, NextResponse } from 'next/server';
import { getSalesSearch } from '@/lib/json-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const q = (searchParams.get('q') || "").trim();

    // 1. Get filtered sales
    const sales = await getSalesSearch(q);

    // 2. BOM for Excel UTF-8 compatibility
    const BOM = "\ufeff";

    // 3. Headers (using ; as separator)
    const headers = [
        "ID", "Cliente", "Cédula", "Email", "Teléfono", "Ciudad",
        "CantTickets", "Total", "Fecha", "Tickets", "MétodoPago", "EstadoPago", "TransacciónID"
    ];

    // Helper to escape CSV fields
    const escape = (value: any) => {
        const s = String(value ?? "");
        // If content has ; " \n, wrap in quotes and double internal quotes
        if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };

    // Helper to format tickets
    // Using ="0123" trick for Excel to preserve leading zeros if needed, 
    // OR just raw string if users prefer. User snippet suggested: `="${String(t).padStart(4, "0")}"`
    // But also said: "Si NO quieres lo de ="0296", usa: String(t)"
    // I will use just the number string padded, but not the ="..." formula by default unless strictly requested to force text mode,
    // as ="..." can be annoying if you want to copy-paste.
    // However, the user snippet explicitly showed: const formatTicketAsText = (t) => ...
    // "Formato de tickets (muy importante)... No truncar jamás"
    // I'll stick to a simple pipe separation first.
    // User snippet has: const formatTicketAsText = (t) => `="${String(t).padStart(4, "0")}"`;
    // I will apply the padding to be safe.
    const rows = sales.map(sale => {
        const c = sale.customer || {} as any;

        // Join tickets with pipe |
        const tickets = (sale.tickets || []).map(t => t.padStart(4, '0')).join("|");

        return [
            sale.id,
            // Cliente: Name reconstruction
            (c.lastName && c.firstName) ? `${c.lastName} ${c.firstName}`.trim() : (c.fullName || "Cliente"),
            c.idNumber || "",
            c.email || "",
            c.phone || "",
            c.city || "",
            sale.tickets?.length || 0,
            sale.total || 0,
            sale.date ? new Date(sale.date).toLocaleString('es-EC') : "",
            tickets,
            // Placeholders for future payment fields if they don't exist yet
            (sale as any).paymentMethod || "",
            (sale as any).paymentStatus || "",
            (sale as any).transactionId || ""
        ].map(escape).join(";");
    });

    const csvContent = BOM + headers.join(";") + "\n" + rows.join("\n");

    const filename = `ventas_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`
        }
    });
}
