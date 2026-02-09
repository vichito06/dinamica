export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const token = process.env.PAYPHONE_TOKEN;
    const clientId = process.env.PAYPHONE_CLIENT_ID;
    const secret = process.env.PAYPHONE_SECRET;
    const encodingPassword = process.env.PAYPHONE_ENCODING_PASSWORD;
    const appId = process.env.PAYPHONE_APP_ID;
    const storeId = process.env.PAYPHONE_STORE_ID;

    const tokenConfigured = Boolean(token && token.length > 0);
    const clientIdConfigured = Boolean(clientId && clientId.length > 0);
    const secretConfigured = Boolean(secret && secret.length > 0);
    const encodingPasswordConfigured = Boolean(encodingPassword && encodingPassword.length > 0);
    const appIdConfigured = Boolean(appId && appId.length > 0);
    const storeConfigured = Boolean(storeId && storeId.length > 0);

    const missing = [];
    if (!tokenConfigured) missing.push("PAYPHONE_TOKEN");
    if (!clientIdConfigured) missing.push("PAYPHONE_CLIENT_ID");

    // User logic for 'ok': "true si PAYPHONE_TOKEN y PAYPHONE_CLIENT_ID existen"
    const ok = tokenConfigured && clientIdConfigured;

    const response = Response.json({
        ok,
        tokenConfigured,
        clientIdConfigured,
        secretConfigured,
        encodingPasswordConfigured,
        appIdConfigured,
        storeConfigured,
        missing,
        runtime: process.env.NEXT_RUNTIME || "nodejs",
        timestamp: new Date().toISOString()
    });

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
}
