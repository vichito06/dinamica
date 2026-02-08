export const runtime = "nodejs";

export async function GET() {
    const ok = Boolean(process.env.PAYPHONE_TOKEN && process.env.PAYPHONE_STORE_ID);
    return Response.json({ ok });
}
