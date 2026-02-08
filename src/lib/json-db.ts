import prisma from '@/lib/prisma';
import fs from "node:fs/promises";
import path from "node:path";

// Persistence configuration
const APP_STATE_ID = "singleton";
const SEED_PATH = path.join(process.cwd(), "raffle-data.json");

// --- Interfaces ---

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
    // Email tracking
    emailSentAt?: string;
    emailMessageId?: string;
    emailStatus?: "pending" | "sent" | "failed";
    emailLastError?: string;
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

export interface DB {
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

// --- Persistence Logic ---

/**
 * Loads state from Neon DB (via Prisma).
 * Falls back to local raffle-data.json ONLY for seeding if DB is empty.
 */
export async function loadState(): Promise<DB> {
    try {
        const row = await prisma.appState.findUnique({
            where: { id: APP_STATE_ID }
        });

        if (row?.data) {
            // Ensure settings exist even if loaded from DB
            const data = row.data as unknown as DB;
            if (!data.settings) data.settings = DEFAULT_SETTINGS;
            return data;
        }

        // Seed from local file if DB is empty
        console.log("Seeding Database from local file...");
        let seed = getInitialData();
        try {
            const seedRaw = await fs.readFile(SEED_PATH, "utf8");
            seed = JSON.parse(seedRaw);
        } catch (e) {
            console.warn("No local seed file found, starting fresh.");
        }

        // Ensure defaults in seed
        if (!seed.settings) seed.settings = DEFAULT_SETTINGS;
        if (!seed.customers) seed.customers = [];
        if (!seed.tickets) seed.tickets = {};
        if (!seed.sales) seed.sales = [];

        // Save initial seed to DB
        await prisma.appState.upsert({
            where: { id: APP_STATE_ID },
            create: { id: APP_STATE_ID, key: "global", data: seed as any },
            update: { data: seed as any },
        });

        return seed;
    } catch (e) {
        console.error("Failed to load state:", e);
        return getInitialData();
    }
}

export async function saveState(next: DB): Promise<void> {
    try {
        await prisma.appState.upsert({
            where: { id: APP_STATE_ID },
            create: { id: APP_STATE_ID, key: "global", data: next as any },
            update: { data: next as any },
        });
    } catch (e) {
        console.error("Failed to save state:", e);
        throw e;
    }
}

// 1. Reserve Tickets
export async function reserveTickets(ticketNumbers: string[], sessionId: string): Promise<{ success: boolean, unavailable?: string[], error?: string }> {
    try {
        const db = await loadState();
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

        await saveState(db);
        return { success: true };

    } catch (e: any) {
        throw e;
    }
}

// 2. Confirm Sale
export async function confirmSale(
    customerData: Customer,
    ticketNumbers: string[],
    total: number,
    sessionId: string
): Promise<Sale> {
    try {
        const db = await loadState();

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
        await saveState(db);
        return newSale;
    } catch (e: any) {
        throw e;
    }
}

export async function getSales() {
    const db = await loadState();
    return db.sales;
}

export async function getSalesSearch(query?: string) {
    const db = await loadState();
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
    const db = await loadState();
    return db.customers;
}

export async function getCustomersSummary() {
    const db = await loadState();
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
    const db = await loadState();
    return Object.values(db.tickets)
        .filter(t => t.status === 'paid' || t.status === 'reserved')
        .map(t => t.number);
}

export async function getSettings() {
    const db = await loadState();
    return db.settings;
}

export async function updateSettings(newSettings: Partial<Settings>) {
    try {
        const db = await loadState();
        db.settings = { ...db.settings, ...newSettings };
        await saveState(db);
        return db.settings;
    } catch (e: any) {
        throw e;
    }
}

export async function getSaleById(id: number) {
    const db = await loadState();
    const sale = db.sales.find(s => s.id === id);
    if (!sale) return null;
    return sale;
}

export async function updateSale(id: number, updates: Partial<Sale>) {
    try {
        const db = await loadState();
        const index = db.sales.findIndex(s => s.id === id);
        if (index === -1) throw new Error('Sale not found');

        const { id: _, tickets: __, total: ___, date: ____, ...safeUpdates } = updates;
        const currentSale = db.sales[index];

        if (safeUpdates.customer) {
            currentSale.customerId = syncCustomerRecord(db, safeUpdates.customer, db.customers);
        }

        db.sales[index] = { ...currentSale, ...safeUpdates };
        await saveState(db);
        return db.sales[index];
    } catch (e: any) {
        throw e;
    }
}

export async function pickWinner(raffleId: number = 1): Promise<{ ticket: Ticket, sale: Sale, customer: Customer } | null> {
    const db = await loadState();

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
