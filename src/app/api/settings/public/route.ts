import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/json-db';

export const dynamic = 'force-dynamic';

export async function GET() {
    const settings = getSettings();
    return NextResponse.json({
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        contactWhatsapp: settings.contactWhatsapp,
        contactText: settings.contactText,
        termsHtml: settings.termsHtml,
        privacyHtml: settings.privacyHtml
    });
}
