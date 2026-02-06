import prisma from '@/lib/prisma';
import { AppState } from '@prisma/client';

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
 */
function syncCustomerRecord(db: DB, customerData: Customer, idPool: CustomerRecord[] = []): string {
    let index = -1;

    if (customerData.idNumber && customerData.idNumber.trim() !== '') {
        index = db.customers.findIndex(c => c.idNumber === customerData.idNumber);
    }

    const now = new Date().toISOString();

    if (index >= 0) {
        const existing = db.customers[index];
        db.customers[index] = {
            ...existing,
            ...customerData,
            updatedAt: now
        };
        return existing.id;
    } else {
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

// Helper interface to track version for optimistic locking
interface DBWithVersion extends DB {
    _version: number;
}

async function readDB(): Promise<DBWithVersion> {
    try {
        let appState = null;
        try {
            // In dev without DB, this might throw or return null depending on prisma init
            // But prisma client throws if connection fails usually.
            appState = await prisma.appState.findUnique({ where: { id: 1 } });
        } catch (e) {
            console.warn("Could not connect to DB, falling back to initial.", e);
        }

        let data: DB;
        let version = 0;

        if (!appState) {
            data = getInitialData();
            // Try to initialize
            try {
                // If we have connection but no data, we create it.
                // If no connection, this throws and we stay in memory (safe fallback for dev without DB)
                const created = await prisma.appState.upsert({
                    where: { id: 1 },
                    update: {},
                    create: {
                        id: 1,
                        version: 0,
                        data: data as any
                    }
                });
                version = created.version;
            } catch (e) {
                // Ignore write failure in fallback mode
            }
        } else {
            data = appState.data as unknown as DB;
            version = appState.version;
        }

        let changed = false;

        // Ensure settings
        if (!data.settings) {
            data.settings = DEFAULT_SETTINGS;
            changed = true;
        }

        // --- Data Integrity & Repair Logic ---
        if (data.sales) {
            const originalCustomers = data.customers || [];
            const newCustomers: CustomerRecord[] = [];
            const tempDB = { ...data, customers: newCustomers };
            const chronologicalSales = [...data.sales].reverse();

            chronologicalSales.forEach((s: any) => {
                if (!s.customer) {
                    s.customer = {
                        firstName: '', lastName: '', fullName: s.client || '',
                        email: s.email || '', idNumber: s.idNumber || '',
                        phone: s.phone || '', country: 'Ecuador',
                        province: s.province || '', city: s.city || '', postalCode: ''
                    };
                }
                s.customerId = syncCustomerRecord(tempDB, s.customer, originalCustomers);
            });
            data.customers = newCustomers;
            data.sales = chronologicalSales.reverse();
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
            try {
                await prisma.appState.updateMany({
                    where: { id: 1, version: version },
                    data: {
                        data: data as any,
                        version: { increment: 1 }
                    }
                });
            } catch (e) {
                // Ignore bg save errors
            }
        }

        return { ...data, _version: version };

    } catch (e) {
        console.error('DB Read Error:', e);
        return { ...getInitialData(), _version: 0 };
    }
}

async function writeDB(data: DBWithVersion): Promise<boolean> {
    const { _version, ...cleanData } = data;

    // Optimistic locking
    const result = await prisma.appState.updateMany({
        where: {
            id: 1,
            version: _version
        },
        data: {
            data: cleanData as any,
            version: { increment: 1 }
        }
    });

    if (result.count === 0) {
        throw new Error("Concurrency Conflict: Database updated by another process.");
    }
    return true;
}

// 1. Reserve Tickets
export async function reserveTickets(ticketNumbers: string[], sessionId: string): Promise<{ success: boolean, unavailable?: string[], error?: string }> {
    let retries = 3;
    while (retries > 0) {
        try {
            const db = await readDB();
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

            await writeDB(db);
            return { success: true };

        } catch (e: any) {
            if (e.message?.includes('Concurrency')) {
                retries--;
                continue;
            }
            throw e;
        }
    }
    return { success: false, error: 'System busy, please try again.' };
}

// 2. Confirm Sale
export async function confirmSale(
    customerData: Customer,
    ticketNumbers: string[],
    total: number,
    sessionId: string
): Promise<Sale> {
    let retries = 3;
    while (retries > 0) {
        try {
            const db = await readDB();

            const missingOrStolen = ticketNumbers.filter(num => {
                const t = db.tickets[num];
                if (!t || t.status === 'paid') return true;
                if (t.status === 'reserved' && t.session_id !== sessionId) return true;
                return false;
            });

            if (missingOrStolen.length > 0) {
                throw new Error(`Tickets no disponibles: ${missingOrStolen.join(', ')}`);
            }

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
            await writeDB(db);
            return newSale;
        } catch (e: any) {
            if (e.message?.includes('Concurrency')) {
                retries--;
                continue;
            }
            throw e;
        }
    }
    throw new Error('Transaction failed due to high concurrency. Please try again.');
}

export async function getSales() {
    const db = await readDB();
    return db.sales;
}

export async function getSalesSearch(query?: string) {
    const db = await readDB();
    if (!query || query.trim() === '') return db.sales;

    const q = query.toLowerCase().trim();
    const isNumeric = /^\d+$/.test(q);

    return db.sales.filter(s => {
        const c = s.customer || ({} as Customer);

        if (s.id.toString().includes(q)) return true;
        if (c.fullName?.toLowerCase().includes(q)) return true;
        if (c.firstName?.toLowerCase().includes(q)) return true;
        if (c.lastName?.toLowerCase().includes(q)) return true;
        if (c.idNumber?.includes(q)) return true;
        if (c.email?.toLowerCase().includes(q)) return true;
        if (c.phone?.includes(q)) return true;

        if (isNumeric) {
            const paddedQ = q.padStart(4, '0');
            const paddedQ6 = q.padStart(6, '0');
            if (s.tickets.some(t => t === q || t === paddedQ || t === paddedQ6)) {
                return true;
            }
        }
        return false;
    });
}

export async function getCustomers() {
    const db = await readDB();
    return db.customers;
}

export async function getCustomersSummary() {
    const db = await readDB();
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

export async function getSoldTickets() {
    const db = await readDB();
    return Object.values(db.tickets)
        .filter(t => t.status === 'paid' || t.status === 'reserved')
        .map(t => t.number);
}

export async function getSettings() {
    const db = await readDB();
    return db.settings;
}

export async function updateSettings(newSettings: Partial<Settings>) {
    let retries = 3;
    while (retries > 0) {
        try {
            const db = await readDB();
            db.settings = { ...db.settings, ...newSettings };
            await writeDB(db);
            return db.settings;
        } catch (e: any) {
            if (e.message?.includes('Concurrency')) {
                retries--;
                continue;
            }
            throw e;
        }
    }
    throw new Error('Failed to update settings');
}

export async function getSaleById(id: number) {
    const db = await readDB();
    const sale = db.sales.find(s => s.id === id);
    if (!sale) return null;
    return sale;
}

export async function updateSale(id: number, updates: Partial<Sale>) {
    let retries = 3;
    while (retries > 0) {
        try {
            const db = await readDB();
            const index = db.sales.findIndex(s => s.id === id);
            if (index === -1) throw new Error('Sale not found');

            const { id: _, tickets: __, total: ___, date: ____, ...safeUpdates } = updates;
            const currentSale = db.sales[index];

            if (safeUpdates.customer) {
                currentSale.customerId = syncCustomerRecord(db, safeUpdates.customer, db.customers);
            }

            db.sales[index] = { ...currentSale, ...safeUpdates };
            await writeDB(db);
            return db.sales[index];
        } catch (e: any) {
            if (e.message?.includes('Concurrency')) {
                retries--;
                continue;
            }
            throw e;
        }
    }
    throw new Error('Failed to update sale');
}

export async function pickWinner(raffleId: number = 1): Promise<{ ticket: Ticket, sale: Sale, customer: Customer } | null> {
    const db = await readDB();

    const eligibleTickets = Object.values(db.tickets).filter(t =>
        t.status === 'paid' &&
        t.raffle_id === raffleId
    );

    if (eligibleTickets.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * eligibleTickets.length);
    const winningTicket = eligibleTickets[randomIndex];

    const winningSale = db.sales.find(s => s.id === winningTicket.sale_id);

    if (!winningSale) {
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
