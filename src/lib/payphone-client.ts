
export interface PayphonePreparePayload {
    amount: number;
    amountWithoutTax: number;
    amountWithTax?: number;
    tax?: number;
    service?: number;
    tip?: number;
    clientTransactionId: string;
    currency: string;
    storeId: string;
    reference: string;
    responseUrl: string;
    cancellationUrl: string;
    timeZone: number;
    email?: string;
    documentId?: string;
    phoneNumber?: string;
}

export interface PayphoneConfirmPayload {
    id: number;
    clientTxId: string;
}

export interface PayphoneResponse<T = any> {
    ok: boolean;
    status: number;
    data?: T;
    text?: string;
    isJson: boolean;
}

export function buildPayphoneHeaders(token: string) {
    const cleanToken = token.trim().replace(/^(bearer\s+|Bearer\s+)/i, "");
    return {
        "Authorization": `Bearer ${cleanToken}`,
        "Content-Type": "application/json",
        "Referer": process.env.APP_URL || "https://yvossoeee.com/"
    };
}

export async function payphonePrepare(payload: PayphonePreparePayload): Promise<PayphoneResponse> {
    const token = process.env.PAYPHONE_TOKEN || "";
    const baseUrl = (process.env.PAYPHONE_BASE_URL || "https://pay.payphonetodoesposible.com").trim().replace(/\/+$/, "");
    const url = `${baseUrl}/api/button/Prepare`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: buildPayphoneHeaders(token),
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        let data: any = null;
        let isJson = false;

        try {
            data = JSON.parse(text);
            isJson = true;
        } catch (e) {
            isJson = false;
        }

        return {
            ok: res.ok && isJson,
            status: res.status,
            data: isJson ? data : undefined,
            text: !isJson ? text : undefined,
            isJson
        };
    } catch (error: any) {
        return {
            ok: false,
            status: 500,
            text: error.message || "Unknown fetch error",
            isJson: false
        };
    }
}

export async function payphoneConfirm(payload: PayphoneConfirmPayload): Promise<PayphoneResponse> {
    const token = process.env.PAYPHONE_TOKEN || "";
    const baseUrl = (process.env.PAYPHONE_BASE_URL || "https://pay.payphonetodoesposible.com").trim().replace(/\/+$/, "");
    const url = `${baseUrl}/api/button/V2/Confirm`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: buildPayphoneHeaders(token),
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        let data: any = null;
        let isJson = false;

        try {
            data = JSON.parse(text);
            isJson = true;
        } catch (e) {
            isJson = false;
        }

        return {
            ok: res.ok && isJson,
            status: res.status,
            data: isJson ? data : undefined,
            text: !isJson ? text : undefined,
            isJson
        };
    } catch (error: any) {
        return {
            ok: false,
            status: 500,
            text: error.message || "Unknown fetch error",
            isJson: false
        };
    }
}
