# Guía de Pruebas PayPhone - v3.0 (STABLE)

Esta guía detalla cómo verificar la integración de PayPhone tras la estandarización final.

## 1. Requisitos de Configuración
Asegúrate de tener estas variables encriptadas en Vercel:
- `PAYPHONE_TOKEN`: Bearer Token de PayPhone.
- `PAYPHONE_STORE_ID`: ID de tu tienda.
- `APP_URL`: `https://yvossoeee.com`
- `PAYPHONE_DEBUG_SECRET`: El secreto para el endpoint de depuración.

---

## 2. Verificar Salud (Health)
Confirma que las variables están presentes y que el servidor responde con la versión correcta.

**PowerShell:**
```powershell
curl.exe -i "https://yvossoeee.com/api/payphone/health"
```

**Respuesta Esperada:**
```json
{
  "ok": true,
  "stable": "3.0.0-FINAL",
  "env": {
    "tokenPresent": true,
    "storeIdPresent": true,
    "appUrlPresent": true,
    "debugSecretPresent": true
  }
}
```

---

## 3. Depuración de Prepare (Debug)
Genera un link de pago de prueba ($1.00) usando el payload mínimo configurado para máxima estabilidad.

**PowerShell:**
```powershell
$secret = "TU_DEBUG_SECRET"
curl.exe -i -H "x-test-secret: $secret" "https://yvossoeee.com/api/payphone/prepare-debug"
```

> [!NOTE]
> Este endpoint usa la ruta `/api/button/Prepare` (sin V2) y omite campos opcionales para evitar errores en el servidor de PayPhone.

---

## 4. Flujo de Confirmación
- **Ruta**: `/api/button/V2/Confirm` (esta SÍ es V2).
- **Idempotencia**: Si intentas confirmar una venta ya pagada, responderá `alreadyPaid: true`.
- **Mapeo**: 
  - Status `3` -> `PAID`.
  - Status `2` -> `CANCELED`.

---

## 5. Notas de Implementación
- **Cero Tolerancia**: No se envían campos monetarios (`tax`, `service`, etc.) si su valor es 0.
- **Zona Horaria**: Se envía como número `-5`.
- **ClientTxId**: Recortado a 16 caracteres para compatibilidad absoluta.
