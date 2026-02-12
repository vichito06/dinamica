import axios, { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Interface para la respuesta unificada del cliente PayPhone
 */
export interface PayPhoneAxiosResponse<T = any> {
    ok: boolean;
    status: number;
    data?: T;
    errorText?: string;
    isJson: boolean;
    contentType?: string;
    snippet?: string;
    requestId?: string;
    timing?: number;
}

const PAYPHONE_BASE_URL = (process.env.PAYPHONE_BASE_URL || "https://pay.payphonetodoesposible.com/api").trim().replace(/\/+$/, "");
const PAYPHONE_TOKEN = (process.env.PAYPHONE_TOKEN || "").trim().replace(/^(bearer\s+|Bearer\s+)/i, "");

// Advanced Circuit Breaker State
let recentFailures: number[] = []; // Timestamps of failures
const FAILURE_THRESHOLD = 3;
const WINDOW_MS = 120000; // 2 minutes window to count failures
const COOLDOWN_MS = 60000; // 60 seconds cooldown if triggered
let circuitOpenUntil: number | null = null;

/**
 * Cliente Axios configurado para PayPhone
 */
export const payphoneAxios: AxiosInstance = axios.create({
    baseURL: PAYPHONE_BASE_URL,
    timeout: 30000,
    headers: {
        'Authorization': `Bearer ${PAYPHONE_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    validateStatus: () => true
});

/**
 * Función auxiliar para realizar peticiones con reintento y circuit breaker
 */
export async function payphoneRequestWithRetry<T = any>(
    config: any,
    retries = 2,
    requestId?: string
): Promise<PayPhoneAxiosResponse<T>> {
    const startTime = Date.now();
    const reqId = requestId || (typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2));

    // Cleanup old failures
    recentFailures = recentFailures.filter(f => Date.now() - f < WINDOW_MS);

    // Circuit Breaker Check
    if (circuitOpenUntil && Date.now() < circuitOpenUntil) {
        console.error(`[PayPhone Client] Circuit Breaker OPEN until ${new Date(circuitOpenUntil).toISOString()}. Skipping ${reqId}.`);
        return {
            ok: false,
            status: 503,
            errorText: `Circuit breaker active. Retry after ${Math.ceil((circuitOpenUntil - Date.now()) / 1000)}s`,
            isJson: false,
            requestId: reqId
        };
    }

    const backoffs = [400, 900];
    const attempt = 2 - retries;

    try {
        const response: AxiosResponse<T> = await payphoneAxios(config);
        const timing = Date.now() - startTime;
        const contentType = response.headers['content-type'] || '';
        const isJson = contentType.includes('application/json');

        // Logic for retries
        if ([502, 503, 504].includes(response.status) && retries > 0) {
            console.warn(`[PayPhone Client] [${reqId}] Received ${response.status}. Retry ${attempt + 1} in ${backoffs[attempt]}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffs[attempt]));
            return payphoneRequestWithRetry(config, retries - 1, reqId);
        }

        // Handle success/failure for circuit breaker
        if (response.status >= 200 && response.status < 300) {
            // Success: slowly clear failures (optional, but keep it simple)
        } else if (response.status >= 500) {
            recentFailures.push(Date.now());
            if (recentFailures.length >= FAILURE_THRESHOLD) {
                circuitOpenUntil = Date.now() + COOLDOWN_MS;
                console.error(`[PayPhone Client] THRESHOLD REACHED. Opening circuit for 60s.`);
            }
        }

        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            data: response.data,
            isJson,
            contentType,
            snippet: !isJson && response.data ? String(response.data).slice(0, 500) : undefined,
            requestId: reqId,
            timing
        };

    } catch (error: any) {
        const timing = Date.now() - startTime;
        const isNetworkError = !error.response;
        const isTimeout = ['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code);

        if ((isNetworkError || isTimeout) && retries > 0) {
            console.warn(`[PayPhone Client] [${reqId}] ${error.message}. Retry ${attempt + 1} in ${backoffs[attempt]}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffs[attempt]));
            return payphoneRequestWithRetry(config, retries - 1, reqId);
        }

        recentFailures.push(Date.now());
        if (recentFailures.length >= FAILURE_THRESHOLD) {
            circuitOpenUntil = Date.now() + COOLDOWN_MS;
        }

        return {
            ok: false,
            status: error.response?.status || 500,
            errorText: error.message,
            isJson: false,
            requestId: reqId,
            timing
        };
    }
}

