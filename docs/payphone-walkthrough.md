# PayPhone Integration - Testing Guide

This guide provides cURL examples to verify the PayPhone integration, covering redirection and confirmation flows.

## 1. Test PayPhone Prepare

Ensure your environment variables (`PAYPHONE_TOKEN`, `PAYPHONE_STORE_ID`, `APP_URL`) are set.

### A. Case: Zero Taxes (Minimalist)
This simulates a $1.00 purchase with no taxes.

```bash
curl -X POST http://localhost:3000/api/payphone/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "saleId": "YOUR_SALE_ID_HERE",
    "reference": "TEST MINIMALIST"
  }'
```

**Expected Behavior:**
- Payload sent to PayPhone should OMIT fields like `tax`, `service`, `tip`.
- Response should contain `payWithCard` URL.

### B. Case: Validation Failure (Simulated)
If you try to send inconsistent amounts (currently internal validation ensures this doesn't happen during normal flow).

---

## 2. Test PayPhone Confirm (Idempotency)

Simulate a payment confirmation from the return page.

```bash
curl -X POST http://localhost:3000/api/payphone/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123456,
    "clientTransactionId": "YOUR_CLIENT_TX_ID"
  }'
```

**Expected Behavior:**
- First call: Should confirm the sale (if valid) and return PayPhone response.
- Subsequent calls: Should return `200 OK` with "Sale already confirmed as paid" message.

---

## 4. Health Check (Environment Validation)

Validate that critical environment variables are set in production without exposing sensitive data.

```powershell
# Windows PowerShell
curl.exe -i "https://yvossoeee.com/api/payphone/health"
```

**Expected Response (JSON):**
```json
{
  "ok": true,
  "env": {
    "tokenPresent": true,
    "storeIdPresent": true,
    "appUrlPresent": true
  },
  "referrerPolicyHint": "origin-when-cross-origin required"
}
```

---

## 5. Debug Endpoint

Access a live test of the upstream connection with detailed payload logs.

### Set up the Debug Secret
1. Add `PAYPHONE_DEBUG_SECRET` to your `.env.local` or Vercel Environment Variables.
2. Value can be any strong string.

### Execute Debug Test
```powershell
# Windows PowerShell
$secret="TU_SECRET_AQUI"
curl.exe -i -H "x-test-secret: $secret" "https://yvossoeee.com/api/payphone/prepare-debug"
```

**Security Notes:**
- If `PAYPHONE_DEBUG_SECRET` is missing, the endpoint returns `503 Service Unavailable`.
- If the header is wrong, it returns `401 Unauthorized`.
- Full tokens are NEVER logged; only the first 6 characters are shown as a prefix.
