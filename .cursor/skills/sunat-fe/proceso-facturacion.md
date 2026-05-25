# Proceso general — facturación electrónica SUNAT Perú

Documento maestro del flujo implementado en `mind-billing-api` (Sprint 1–3). Complementa reglas de negocio en [SKILL.md](SKILL.md) y casos en [casos-practicos.md](casos-practicos.md).

---

## Visión general

```
                    ┌─────────────────────────────────────┐
                    │         mind-billing-api            │
                    │  Auth (API key + JWT) → Company     │
                    └─────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
    Factura 01                   Boleta 03                  Notas 07/08
          │                           │                           │
    sendBill (sync)              firma local                 firma local
          │                      status: signed                   │
          ▼                           │                    ┌──────┴──────┐
    accepted/rejected                 │                    │             │
          │                           ▼                    ▼             ▼
    NC → sendBill              RC (sendSummary)      RC altas      sendBill
    (factura sigue accepted)          │               (boleta)    (factura)
          │                           ▼
    RA → sendSummary                  getStatus (async)
    (anular factura)                  ticket + CDR
                                      ▼
                               accepted / voided
```

**Dos caminos SUNAT distintos:**

| Camino | SOAP | Comprobantes | Respuesta |
|--------|------|--------------|-----------|
| **Síncrono** | `sendBill` | `01`, NC/ND sobre factura | CDR inmediato |
| **Asíncrono** | `sendSummary` + `getStatus` | RC (boletas/notas), RA (bajas factura) | Ticket → polling → CDR |

---

## Ciclo de vida por tipo de documento

### Factura (`01`)

1. `POST /v1/invoices` → UBL + firma + `sendBill`
2. Estado: `accepted` | `rejected` | `failed`
3. **Anular:** `POST /v1/voided-documents` (RA) — no RC void
4. **NC/ND:** `POST /v1/credit-notes` | `debit-notes` → `sendBill` automático
5. **Factura original:** permanece `accepted` tras NC (SUNAT no la voided por NC)

### Boleta (`03`)

1. `POST /v1/boletas` → UBL + firma → `signed` (no va a SUNAT aún)
2. `POST /v1/daily-summaries` (RC altas, condition `1`) → `sendSummary`
3. Tras CDR aceptado → boleta `accepted`
4. **Revertir no entregada:** `POST /v1/daily-summaries/void` (condition `3`) → `voided`
5. **Revertir entregada:** NC `07` + RC altas con la NC

### Nota de crédito / débito (`07` / `08`)

| Afecta | Tras crear | Informar SUNAT | Doc afectado tras NC |
|--------|------------|----------------|----------------------|
| Boleta `03` | `signed` | RC del día (`referenceDate` = `issueDate` NC) | Boleta sigue `accepted` |
| Factura `01` | `sendBill` inmediato | No RC | Factura sigue `accepted` |

Series dev seed: `FC01`/`BC01` (NC), `FD01`/`BD01` (ND).

---

## RC — Resumen de comprobantes (`SummaryDocuments`)

**Tabla:** `daily_summaries` con `summary_type = 'RC'`.

| Variante | Endpoint | Docs entrada | ConditionCode | Resultado docs |
|----------|----------|--------------|---------------|----------------|
| Altas | `POST /daily-summaries` | `03`/`07`/`08` `signed`, sin RC | `1` | `accepted` |
| Void | `POST /daily-summaries/void` | `03` `accepted` + RC previo | `3` | `voided` |

**Fechas:**

- `referenceDate` = fecha **emisión** de los comprobantes en las líneas
- `issueDate` = fecha **generación/envío** del RC (típ. hoy)

**Selección RC altas (automática):** `signed` + `daily_summary_id IS NULL` + `issueDate = referenceDate`.

**Selección RC void (manual):** `documentIds[]` UUIDs; todas misma `issueDate`; validada vs `referenceDate`.

---

## RA — Resumen de bajas (`VoidedDocuments`)

**Tabla:** `daily_summaries` con `summary_type = 'RA'`.

| Campo | Uso |
|-------|-----|
| Endpoint | `POST /v1/voided-documents` |
| Docs | Solo facturas `01` `accepted` |
| XML línea | `sac:DocumentSerialID` + `sac:DocumentNumberID` (no `cbc:ID` compuesto) |
| Resultado | Factura → `voided` tras CDR aceptado |

**Polling:** mismo endpoint que RC → `POST /v1/daily-summaries/:id/status`.

---

## Estados del sistema

### Documento (`documents.status`)

| Estado | Significado |
|--------|-------------|
| `draft` | Nota factura antes de envío (transitorio) |
| `signed` | Boleta/NC boleta firmada, pendiente RC |
| `submitted` | Enviado a SUNAT (transitorio) |
| `accepted` | CDR aceptado |
| `rejected` | SUNAT rechazó |
| `failed` | Error técnico (HTTP, timeout) |
| `voided` | Anulado vía RC void o RA |

### Resumen (`daily_summaries.status`)

`draft` → `submitted` → `processing` → `accepted` | `rejected` | `failed`

RC y RA comparten estados. Consultar con `GET /daily-summaries/:id` o `POST .../status`.

---

## Integración SUNAT (técnico)

### Credenciales

- **Beta:** `companies.sol_username` / `sol_password` o default `{RUC}MODDATOS` / `MODDATOS`
- **Homologación / producción:** credenciales SOL reales obligatorias
- **`.env`:** solo URLs (`SUNAT_BILL_SERVICE_BETA`, `_HOMOLOGACION`, `_PROD`); `SUNAT_ENV` no lo lee la app

### Ambiente por empresa

`companies.sunat_environment`: `beta` | `homologacion` | `production`

### Cliente SOAP (`BillServiceClient`)

- `sendBill` — facturas y NC/ND factura
- `sendSummary` — RC y RA (ZIP con XML firmado)
- `getStatus` — polling ticket (código `98` = en proceso)

### Polling actual

- 5 intentos × 2 s (~8 s total) en envío inicial
- Si queda `processing` o falla `getStatus` con ticket → reintentar `POST /daily-summaries/:id/status` manualmente

---

## SUNAT beta — comportamiento conocido

Durante desarrollo local observamos:

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| `sendSummary` OK + ticket, luego `getStatus` HTTP 401 nginx | Beta inestable / proxy SUNAT | Esperar 1–2 min, `POST .../status`; **no** crear RC/RA duplicado |
| RC/RA en `processing` largo | SUNAT tarda (código 98) | Polling manual |
| `sendSummary` 401 sin ticket | Credenciales o beta caído | Verificar SOL; reintentar |
| Factura bloqueada con `daily_summary_id` tras RA failed sin ticket | Envío falló antes del ticket | API libera automáticamente; SQL manual si aplica |

**Validación fiable de RC/RA:** probar en **homologación** con RUC y certificado real.

---

## Auth dev

```
X-Api-Key: mbak_dev00000000000000000000000001
Login: admin / admin123
Company: 00000000-0000-4000-8000-000000000001
RUC demo: 20000000001
```

---

## Reglas de negocio críticas — entregada vs no entregada

Ver árbol en [SKILL.md](SKILL.md). Resumen:

- **No entregada** + boleta `accepted` → RC void (`3`)
- **Entregada** → NC + RC altas
- **Factura anular** → RA (nunca RC void)
- **No mezclar** void y NC sobre la misma boleta por el mismo caso

---

## Archivos clave en el repo

| Área | Archivos |
|------|----------|
| BD | [docs/DATABASE.md](../../../docs/DATABASE.md), `.cursor/skills/sunat-fe/base-de-datos.md` |
| RC | `daily-summaries.service.ts`, `daily-summaries-rc.util.ts`, `daily-summaries-xml.helper.ts` |
| RA | `voided-documents.service.ts`, `voided-xml.builder.ts` |
| Notas | `documents.service.ts`, `note-xml.builder.ts` |
| Boletas | `boleta-xml.builder.ts` |
| RC XML | `summary-xml.builder.ts` |
| SUNAT | `bill-service.client.ts`, `sunat-error.util.ts` |
| API | `documents.controller.ts` |
| BD | `daily-summary.entity.ts`, migraciones Sprint 3 |
