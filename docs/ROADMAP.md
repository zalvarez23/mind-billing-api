# Roadmap — mind-billing-api

Estado del plan de facturación electrónica SUNAT (Perú).

| Doc          | Contenido                                          |
| ------------ | -------------------------------------------------- |
| Este archivo | Sprints, hecho vs pendiente, **backlog de tareas** |
| [API-REFERENCE.md](./API-REFERENCE.md) | **Referencia HTTP** — consumo desde frontend, ejemplos |
| [DATABASE.md](./DATABASE.md) | **Esquema PostgreSQL** — tablas, relaciones, estados, queries |
| `.cursor/skills/sunat-fe/` | Reglas SUNAT, casos prácticos, guía frontend, mapeo API |

---

## Progreso por sprint

```
Sprint 1  ████████████████████  100%  Auth + BD + seed multi-empresa
Sprint 2  ███████████████████░   ~95%  Factura 01 + sendBill + CDR + cert BD
Sprint 3  ███████████████████░   ~90%  Boletas + RC + notas + RA + hardening TX
Sprint 4  ░░░░░░░░░░░░░░░░░░░░    0%  PDF, webhooks, Swagger, homolog/prod
Sprint 5  ░░░░░░░░░░░░░░░░░░░░    0%  GRE, retención, percepción (diferido)
```

---

## Hecho

### Sprint 1

- Auth JWT + API key por empresa
- Postgres, migraciones, seed dev
- Series: `F001`, `B001`, `FC01`/`BC01`, `FD01`/`BD01`
- Certificado dev en `certificates`

### Sprint 2

- `POST /v1/invoices` — factura `01`, UBL, firma, `sendBill`, CDR
- Correlativo por `(company_id, doc_type, serie)` con lock pessimista
- Certificado por empresa en tabla `certificates`
- Estados `accepted` / `rejected` / `failed`, submissions

### Sprint 3

**Boletas y RC**

- `POST /v1/boletas` — boleta `03`, firma local, estado `signed`
- `POST /v1/daily-summaries` — RC altas: boletas + notas `signed` (`ConditionCode 1`)
- `POST /v1/daily-summaries/void` — RC anulación boletas `accepted` (`ConditionCode 3`) → `voided`
- `BillingReference` en líneas RC para notas `07`/`08`
- Selección automática RC altas; selección manual RC void por `documentIds[]`
- Guard: no duplicar RC mismo `issueDate` si hay ticket pendiente

**Notas**

- `POST /v1/credit-notes` — nota `07`
- `POST /v1/debit-notes` — nota `08`
- Boleta afectada → `signed`, incluir en RC
- Factura afectada → `sendBill` inmediato; factura **permanece `accepted`**

**RA (bajas factura)**

- `POST /v1/voided-documents` — `VoidedDocuments` para facturas `01` `accepted`
- Almacenado en `daily_summaries` (`summary_type = RA`)
- XML RA: `sac:DocumentSerialID` + `sac:DocumentNumberID` (fix parse SUNAT)
- Tras CDR aceptado → factura `voided`

**Integración SUNAT async**

- `sendSummary` + `getStatus` en `BillServiceClient`
- Polling inicial 5×2s; reconsulta manual `POST /daily-summaries/:id/status`
- Tabla `daily_summaries`: `RC` | `RA`, ticket, CDR, estados

**Hardening**

- Transacciones con lock pessimista (correlativos RC/RA, docs en void, series)
- RC void: `payload._rcVoid` + rollback si falla sin ticket
- RA: libera `daily_summary_id` si falla envío sin ticket
- Helpers: `daily-summaries-rc.util.ts`, `daily-summaries-xml.helper.ts`

**Probado en dev beta**

- Facturas `sendBill` OK
- RC altas/void: envío OK; polling `getStatus` intermitente (401 nginx)
- RA: `sendSummary` OK con ticket; mismo comportamiento polling beta

---

## Conocido / limitaciones actuales

| Tema | Estado |
|------|--------|
| SUNAT beta `getStatus` | Intermitente (401 nginx); reintentar `/status` |
| Polling automático corto | 5×2s; RC/RA pueden quedar `processing` → polling manual |
| `ConditionCode 2` (modificación RC) | No implementado |
| Campo “entregada al cliente” | Solo lógica UI; no persistido en API |
| Homologación / producción | Pendiente Sprint 4 |
| `SUNAT_ENV` en `.env` | No leído por app; usa `companies.sunat_environment` |

---

## Backlog — tareas para después

### Sprint 2 — cierre opcional

- [ ] Unique `(company_id, doc_type, serie, correlativo)` en `documents`
- [ ] Tests e2e restaurados / ampliados

### Sprint 3 — mejoras opcionales

- [ ] Si hay ticket y falla primer `getStatus`, dejar `processing` + hint (no `failed`)
- [ ] Delay inicial antes del primer poll (SUNAT beta)
- [ ] `getStatus` con más reintentos / backoff configurable vía `.env`
- [ ] Endpoint listado `GET /daily-summaries` (historial RC/RA)

### Sprint 4

- [ ] PDF comprobante
- [ ] Webhooks estado SUNAT
- [ ] Swagger / OpenAPI
- [ ] Cifrado `pfx_password` en BD
- [ ] Flujo homologación → producción (credenciales SOL reales, cert real)
- [ ] Validación RC/RA end-to-end en homologación

---

## Endpoints

| Método | Ruta                             | Descripción                    |
| ------ | -------------------------------- | ------------------------------ |
| POST   | `/v1/auth/login`                 | Token JWT                      |
| GET    | `/v1/auth/me`                    | Usuario actual                 |
| POST   | `/v1/invoices`                   | Factura + envío SUNAT          |
| POST   | `/v1/boletas`                    | Boleta firmada (`signed`)      |
| POST   | `/v1/credit-notes`               | Nota crédito `07`              |
| POST   | `/v1/debit-notes`                | Nota débito `08`               |
| POST   | `/v1/daily-summaries`            | RC altas (03, 07, 08 `signed`) |
| POST   | `/v1/daily-summaries/void`       | RC anulación boletas `accepted` (condition `3`) |
| POST   | `/v1/voided-documents`           | RA baja facturas `accepted`    |
| GET    | `/v1/daily-summaries/:id`        | Detalle RC/RA                  |
| POST   | `/v1/daily-summaries/:id/status` | Reconsultar ticket (RC y RA)   |
| GET    | `/v1/documents`                  | Listado paginado (filtros fecha, tipo, status) |
| GET    | `/v1/documents/:id`              | Detalle documento              |
| GET    | `/v1/documents/:id/print-data`   | Impresión + texto QR SUNAT     |
| GET    | `/v1/documents/:id/xml`          | XML                            |
| GET    | `/v1/documents/:id/cdr`          | CDR                            |

---

## Flujos resumidos

### Notas

| Documento afectado | Serie típica    | Envío                    | Doc afectado tras NC |
| ---------------- | --------------- | ------------------------ | -------------------- |
| Boleta `03`        | `BC01` / `BD01` | `signed` → RC            | Sigue `accepted`     |
| Factura `01`       | `FC01` / `FD01` | `sendBill` inmediato     | Sigue `accepted`     |

Body: `documentoAfectadoId` (UUID) + `cliente` + `items`.

### RA — anular factura

```json
POST /v1/voided-documents
{
  "documentIds": ["uuid-factura-aceptada"],
  "referenceDate": "2026-05-24",
  "issueDate": "2026-05-25",
  "motivoBaja": "ERROR EN DATOS"
}
```

Polling: `POST /v1/daily-summaries/{dailySummaryId}/status`

### RC void — an. no entregada

```json
POST /v1/daily-summaries/void
{
  "documentIds": ["uuid-boleta"],
  "referenceDate": "2026-05-24",
  "issueDate": "2026-05-25"
}
```

---

## Configuración SUNAT

### `.env`

```env
SUNAT_BILL_SERVICE_BETA=https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService
SUNAT_BILL_SERVICE_HOMOLOGACION=https://www.sunat.gob.pe/ol-ti-itcpgem-sqa/billService
SUNAT_BILL_SERVICE_PROD=https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService
```

### Empresa (BD)

- `sunat_environment`: `beta` | `homologacion` | `production`
- `sol_username`, `sol_password`: obligatorios fuera de beta

---

## Referencias

- [FE Primer — Resumen diario](https://fe-primer.greenter.dev/docs/resumen_diario)
- Skill interno: `.cursor/skills/sunat-fe/SKILL.md`
- Base de datos: [DATABASE.md](./DATABASE.md)
- Casos prácticos: `.cursor/skills/sunat-fe/casos-practicos.md`
- Proceso general: `.cursor/skills/sunat-fe/proceso-facturacion.md`

Estados ítem RC: `1` alta, `2` modificar, `3` anular.

RA: `VoidedDocuments` vía `sendSummary` (facturas, no boletas).
