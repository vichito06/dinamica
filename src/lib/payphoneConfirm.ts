import { payphoneRequestWithRetry } from "./payphoneClient";

export interface PayPhoneConfirmResult {
    success: boolean;
    status: 'APPROVED' | 'REJECTED' | 'CANCELED' | 'PENDING' | 'UNKNOWN';
    raw?: any;
    message?: string;
    transactionId?: string;
}

/**
 * Llama al endpoint de confirmación V2 de PayPhone (Server-to-Server)
 * 
 * @param id El paymentId devuelto por PayPhone en la preparación
 * @param clientTransactionId El ID de transacción cliente (debe coincidir con la preparación)
 */
export async function confirmPayphonePayment(id: string | number, clientTransactionId: string): Promise<PayPhoneConfirmResult> {
    const requestId = `confirm_s2s_${Date.now()}`;

    try {
        console.log(`[PayPhone Confirm S2S] Calling V2 Confirm for id=${id}, clientTxId=${clientTransactionId}`);

        const result = await payphoneRequestWithRetry({
            method: 'POST',
            url: '/button/V2/Confirm',
            data: {
                id: id,
                clientTxId: clientTransactionId
            }
        }, 1, requestId);

        if (!result.ok) {
            console.error(`[PayPhone Confirm S2S] [${requestId}] API Error:`, result.data || result.errorText);
            return {
                success: false,
                status: 'UNKNOWN',
                message: result.errorText || 'Error en comunicación con PayPhone',
                raw: result.data
            };
        }

        const data = result.data;
        const statusCode = data.statusCode;
        const transactionStatus = data.transactionStatus; // APPROVED, REJECTED, etc.

        // Mapeo de estados según documentación oficial (Conceptualmente)
        // statusCode 3 = Approved
        // statusCode 2 = Canceled/Rejected

        if (transactionStatus === 'APPROVED' || statusCode === 3) {
            return {
                success: true,
                status: 'APPROVED',
                transactionId: String(data.transactionId),
                raw: data
            };
        }

        if (transactionStatus === 'REJECTED' || transactionStatus === 'CANCELED' || statusCode === 2) {
            return {
                success: false,
                status: transactionStatus || (statusCode === 2 ? 'REJECTED' : 'UNKNOWN'),
                raw: data
            };
        }

        return {
            success: false,
            status: 'PENDING',
            raw: data
        };

    } catch (error: any) {
        console.error(`[PayPhone Confirm S2S] [${requestId}] Crash:`, error);
        return {
            success: false,
            status: 'UNKNOWN',
            message: error.message
        };
    }
}
