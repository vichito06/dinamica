import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'raffle-data.json');

export type TicketStatus = 'reserved' | 'paid' | 'cancelled' | 'expired';

export interface Ticket {
    number: string;
    raffle_id: number;
    status: TicketStatus;
    sale_id?: number;
    reserved_at?: string;
    expires_at?: string;
    session_id?: string;
}

export interface Customer {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    idNumber: string;
    phone: string;
    country: string;
    province: string;
    city: string;
    postalCode?: string;
}

export interface CustomerRecord extends Customer {
    id: string;
    createdAt: string;
    updatedAt: string;
}

export interface Sale {
    id: number;
    customerId: string; // Foreign Key to CustomerRecord
    customer: Customer; // Snapshot data
    tickets: string[];
    total: number;
    date: string;
}

export interface Settings {
    raffleTitle: string;
    ticketPrice: number;
    prizes: { title: string, amount: string }[];
    contactEmail: string;
    contactPhone?: string;
    contactWhatsapp?: string;
    contactText?: string;
    termsHtml?: string;
    privacyHtml?: string;
}

const DEFAULT_SETTINGS: Settings = {
    raffleTitle: "Dinámica 1",
    ticketPrice: 1,
    prizes: [
        { title: "Primer Premio", amount: "$1000" },
        { title: "Segundo Premio", amount: "$300" },
        { title: "Tercer Premio", amount: "$100" }
    ],
    contactEmail: "contacto@yvossoeee.com",
    contactText: "Estamos para ayudarte con cualquier duda o consulta.",
    termsHtml: "<h2>Términos y Condiciones Generales</h2><p>Bienvenido a la Dinámica. Al participar, aceptas cumplir con las siguientes reglas...</p><h3>Participación</h3><p>La participación es voluntaria y requiere ser mayor de edad.</p>",
    privacyHtml: "<h2>Política de Privacidad</h2><p>Respetamos tu privacidad y protegemos tus datos personales...</p>"
};

interface DB {
    sales: Sale[];
    tickets: Record<string, Ticket>;
    settings: Settings;
    customers: CustomerRecord[];
}

function getInitialData(): DB {
    return { sales: [], tickets: {}, settings: DEFAULT_SETTINGS, customers: [] };
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Syncs a customer record based EXCLUSIVELY on idNumber (Cédula).
 * To ensure stability during migrations, it can reuse an ID from an existing pool.
 */
function syncCustomerRecord(db: DB, customerData: Customer, idPool: CustomerRecord[] = []): string {
    let index = -1;

    // RULE: Identity = Cédula.
    if (customerData.idNumber && customerData.idNumber.trim() !== '') {
        // Search in the current collection being built
        index = db.customers.findIndex(c => c.idNumber === customerData.idNumber);
    }

    const now = new Date().toISOString();

    if (index >= 0) {
        // Update the record in the current build with most recent data
        const existing = db.customers[index];
        db.customers[index] = {
            ...existing,
            ...customerData,
            updatedAt: now
        };
        return existing.id;
    } else {
        // Not found in current build. Check if we can reuse an ID from the pool (stable identity)
        let customerId: string | undefined;
        if (customerData.idNumber && customerData.idNumber.trim() !== '') {
            const original = idPool.find(c => c.idNumber === customerData.idNumber);
            if (original) customerId = original.id;
        }

        if (!customerId) customerId = generateId();

        db.customers.push({
            ...customerData,
            id: customerId,
            createdAt: now,
            updatedAt: now
        });
        return customerId;
    }
}

function readDB(): DB {
    if (!fs.existsSync(DATA_FILE)) {
        const initial = getInitialData();
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        let changed = false;

        // Ensure settings
        if (!data.settings) {
            data.settings = DEFAULT_SETTINGS;
            changed = true;
        }

        // --- Data Integrity & Repair Logic (MIGRATION) ---
        // We rebuild 'customers' to ensure Cédula-based uniqueness and stable IDs.
        if (data.sales) {
            const originalCustomers = data.customers || [];
            const newCustomers: CustomerRecord[] = [];

            // Build a temp database structure to use with helper
            const tempDB = { ...data, customers: newCustomers };

            // Sort chronically to ensure createdAt is accurate for the first purchase
            const chronologicalSales = [...data.sales].reverse();

            chronologicalSales.forEach((s: any) => {
                // Ensure snapshot
                if (!s.customer) {
                    s.customer = {
                        firstName: '', lastName: '', fullName: s.client || '',
                        email: s.email || '', idNumber: s.idNumber || '',
                        phone: s.phone || '', country: 'Ecuador',
                        province: s.province || '', city: s.city || '', postalCode: ''
                    };
                }

                // Map sale to customerId and build/update customer record
                // REUSING original IDs based on Cédula for stability across different readDB() calls
                s.customerId = syncCustomerRecord(tempDB, s.customer, originalCustomers);
            });

            data.customers = newCustomers;
            data.sales = chronologicalSales.reverse(); // Back to UI order
            changed = true;
        }

        // Cleanup expired tickets
        if (data.tickets) {
            const now = new Date();
            Object.keys(data.tickets).forEach(key => {
                const ticket = data.tickets[key];
                if (ticket.status === 'reserved' && ticket.expires_at) {
                    if (new Date(ticket.expires_at) < now) {
                        delete data.tickets[key];
                        changed = true;
                    }
                }
            });
        }

        if (changed) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        }

        return data;
    } catch (e) {
        console.error('DB Read Error:', e);
        // CRITICAL: Do NOT return initial data if file exists but is corrupted,
        // as this would lead to DATA LOSS on the next write.
        if (fs.existsSync(DATA_FILE)) {
            const backupPath = `${DATA_FILE}.corrupted.${Date.now()}`;
            fs.copyFileSync(DATA_FILE, backupPath);
            console.error(`Corrupted database backed up to: ${backupPath}`);
            throw new Error(`Database corrupted. Backup created at ${backupPath}. Fix manually.`);
        }
        return getInitialData();
    }
}

function writeDB(data: DB) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 1. Reserve Tickets
export function reserveTickets(ticketNumbers: string[], sessionId: string): { success: boolean, unavailable?: string[], error?: string } {
    const db = readDB();
    const unavailable: string[] = [];

    const invalid = ticketNumbers.some(n => {
        const num = parseInt(n, 10);
        return isNaN(num) || num < 1 || num > 9999;
    });

    if (invalid) {
        return { success: false, error: 'Tickets fuera de rango.' };
    }

    ticketNumbers.forEach(num => {
        const ticket = db.tickets[num];
        if (ticket) {
            if (ticket.status === 'reserved' && ticket.session_id === sessionId) return;
            unavailable.push(num);
        }
    });

    if (unavailable.length > 0) return { success: false, unavailable };

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    ticketNumbers.forEach(num => {
        db.tickets[num] = {
            number: num, raffle_id: 1, status: 'reserved',
            reserved_at: new Date().toISOString(), expires_at: expiresAt, session_id: sessionId
        };
    });

    writeDB(db);
    return { success: true };
}

// 2. Confirm Sale
export function confirmSale(
    customerData: Customer,
    ticketNumbers: string[],
    total: number,
    sessionId: string
) {
    const db = readDB();

    const missingOrStolen = ticketNumbers.filter(num => {
        const t = db.tickets[num];
        if (!t || t.status === 'paid') return true;
        if (t.status === 'reserved' && t.session_id !== sessionId) return true;
        return false;
    });

    if (missingOrStolen.length > 0) {
        throw new Error(`Tickets no disponibles: ${missingOrStolen.join(', ')}`);
    }

    // Upsert Customer strictly by Cédula
    const customerId = syncCustomerRecord(db, customerData, db.customers);

    const saleId = 1000 + db.sales.length + 1;
    const newSale: Sale = {
        id: saleId, customerId, customer: customerData,
        tickets: ticketNumbers, total, date: new Date().toISOString()
    };

    ticketNumbers.forEach(num => {
        if (db.tickets[num]) {
            db.tickets[num].status = 'paid';
            db.tickets[num].sale_id = saleId;
            db.tickets[num].expires_at = undefined;
        }
    });

    db.sales.unshift(newSale);
    writeDB(db);
    return newSale;
}

export function getSales() {
    return readDB().sales;
}

export function getSalesSearch(query?: string) {
    const db = readDB();
    if (!query || query.trim() === '') return db.sales;

    const q = query.toLowerCase().trim();
    const isNumeric = /^\d+$/.test(q);

    return db.sales.filter(s => {
        const c = s.customer || ({} as Customer);

        // 1. Search by Sale ID
        if (s.id.toString().includes(q)) return true;

        // 2. Search by Customer Fields (Case-insensitive)
        if (c.fullName?.toLowerCase().includes(q)) return true;
        if (c.firstName?.toLowerCase().includes(q)) return true;
        if (c.lastName?.toLowerCase().includes(q)) return true;
        if (c.idNumber?.includes(q)) return true;
        if (c.email?.toLowerCase().includes(q)) return true;
        if (c.phone?.includes(q)) return true;

        // 3. Search by Tickets (Exact match in the array)
        if (isNumeric) {
            // Check for exact match or padded match (raffle uses 4 or 6 digits usually)
            // The system seems to use 4 digits based on confirmSale code: .padStart(4, '0')
            const paddedQ = q.padStart(4, '0');
            const paddedQ6 = q.padStart(6, '0');
            if (s.tickets.some(t => t === q || t === paddedQ || t === paddedQ6)) {
                return true;
            }
        }

        return false;
    });
}

export function getCustomers() {
    return readDB().customers;
}

/**
 * Returns customers with aggregated stats (ventas, tickets, total)
 */
export function getCustomersSummary() {
    const db = readDB();
    const sales = db.sales;
    return db.customers.map(c => {
        const cSales = sales.filter(s => s.customerId === c.id);
        return {
            ...c,
            stats: {
                ventas: cSales.length,
                tickets: cSales.reduce((acc, s) => acc + s.tickets.length, 0),
                total: cSales.reduce((acc, s) => acc + s.total, 0)
            }
        };
    });
}

export function getSoldTickets() {
    const db = readDB();
    return Object.values(db.tickets)
        .filter(t => t.status === 'paid' || t.status === 'reserved')
        .map(t => t.number);
}

export function getSettings() {
    return readDB().settings;
}

export function updateSettings(newSettings: Partial<Settings>) {
    const db = readDB();
    db.settings = { ...db.settings, ...newSettings };
    writeDB(db);
    return db.settings;
}

export function getSaleById(id: number) {
    const db = readDB();
    const sale = db.sales.find(s => s.id === id);
    if (!sale) return null;
    return sale;
}

export function updateSale(id: number, updates: Partial<Sale>) {
    const db = readDB();
    const index = db.sales.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Sale not found');

    const { id: _, tickets: __, total: ___, date: ____, ...safeUpdates } = updates;
    const currentSale = db.sales[index];

    if (safeUpdates.customer) {
        // Re-sync and update currentSale with the potentially new ID/Record
        currentSale.customerId = syncCustomerRecord(db, safeUpdates.customer, db.customers);
    }

    db.sales[index] = { ...currentSale, ...safeUpdates };
    writeDB(db);
    return db.sales[index];
}

export function pickWinner(raffleId: number = 1): { ticket: Ticket, sale: Sale, customer: Customer } | null {
    const db = readDB();

    // 1. Get all eligible paid tickets for this raffle
    const eligibleTickets = Object.values(db.tickets).filter(t =>
        t.status === 'paid' &&
        t.raffle_id === raffleId
    );

    if (eligibleTickets.length === 0) return null;

    // 2. Random selection
    const randomIndex = Math.floor(Math.random() * eligibleTickets.length);
    const winningTicket = eligibleTickets[randomIndex];

    // 3. Get associated sale and customer
    const winningSale = db.sales.find(s => s.id === winningTicket.sale_id);

    if (!winningSale) {
        // Should not happen for paid tickets, but handle gracefully
        throw new Error(`Data integrity error: Ticket ${winningTicket.number} has no associated sale.`);
    }

    const customer = db.customers.find(c => c.id === winningSale.customerId);

    if (!customer) {
        throw new Error(`Data integrity error: Sale ${winningSale.id} has no associated customer.`);
    }

    return {
        ticket: winningTicket,
        sale: winningSale,
        customer: customer
    };
}
