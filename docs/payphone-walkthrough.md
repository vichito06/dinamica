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

## 3. Checklist for Production

- [ ] **Referrer-Policy**: Header `origin-when-cross-origin` must be active in `next.config.js`.
- [ ] **PayPhone Dashboard**: Domain authorized? `responseUrl` set? App type is **WEB**?
- [ ] **HTTPS**: Production URL must have SSL.
- [ ] **AbortController**: Fetch timeout set to 10s to prevent hang-ups.
- [ ] **Error Snippets**: Non-JSON responses from PayPhone are captured and logged (check logs for `PAYPHONE_NON_JSON`).

## 4. Debug Endpoint
Access `/api/payphone/prepare-debug` (requires authentication) to see a live test of the upstream connection with detailed payload logs.
