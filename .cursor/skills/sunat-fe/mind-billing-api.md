# mind-billing-api — mapeo SUNAT ↔ código

Referencia técnica del backend. Flujo general en [proceso-facturacion.md](proceso-facturacion.md).

---

## Arquitectura SOAP

| Método | Uso | Comprobantes |
|--------|-----|--------------|
| `sendBill` | CDR síncrono | `01`, NC/ND sobre factura |
| `sendSummary` | Envío async → ticket | RC, RA |
| `getStatus` | Polling ticket | RC, RA (`98` = processing) |

Implementación: `src/sunat/bill-service.client.ts`

Credenciales: `companies.sol_username` / `sol_password`. En beta, default `{ruc}MODDATOS` / `MODDATOS`.

URLs: `.env` → `SUNAT_BILL_SERVICE_BETA` | `_HOMOLOGACION` | `_PROD`. Ambiente efectivo: `companies.sunat_environment` (no `SUNAT_ENV` del `.env`).

---

## Endpoints por flujo de negocio

| Flujo | Endpoints en orden |
|-------|-------------------|
| Factura | `POST /v1/invoices` |
| Boleta del día → SUNAT | `POST /v1/boletas` → `POST /v1/daily-summaries` → `POST /v1/daily-summaries/:id/status` |
| NC boleta | `POST /v1/credit-notes` → `POST /v1/daily-summaries` → `.../status` |
| NC factura | `POST /v1/credit-notes` (sendBill automático, sin RC) |
| Anular boleta no entregada | `POST /v1/daily-summaries/void` → `.../status` |
| Anular factura | `POST /v1/voided-documents` → `POST /v1/daily-summaries/:id/status` |

Auth: `X-Api-Key` + `Authorization: Bearer JWT` en todas las rutas de documentos.

---

## Tabla `daily_summaries`

RC y RA comparten la misma entidad.

| Campo | RC | RA |
|-------|----|----|
| `summary_type` | `RC` | `RA` |
| `summary_code` | `RC-YYYYMMDD-N` | `RA-YYYYMMDD-N` |
| `reference_date` | Emisión docs en líneas | Emisión facturas a dar de baja |
| `issue_date` | Fecha envío comunicación | Fecha envío RA |
| `ticket` | De `sendSummary` | De `sendSummary` |
| Storage folder | `RC/` | `RA/` |

---

## Endpoints RC / RA

| Endpoint | Documentos | Condition | Estado resultante |
|----------|------------|-----------|-------------------|
| `POST /v1/daily-summaries` | 03/07/08 `signed`, sin RC | `1` | `accepted` |
| `POST /v1/daily-summaries/void` | 03 `accepted` por UUID | `3` | `voided` |
| `POST /v1/voided-documents` | 01 `accepted` (RA) | N/A | `voided` |
| `POST /v1/daily-summaries/:id/status` | Cualquier RC/RA con ticket | — | Actualiza según CDR |
| `GET /v1/daily-summaries/:id` | Detalle RC/RA | — | — |

---

## Notas (`07` / `08`)

| Afectado | Tras crear | Informar SUNAT | Doc afectado |
|----------|------------|----------------|--------------|
| Boleta `03` | `status = signed` | RC altas | Sigue `signed` o `accepted` |
| Factura `01` | `sendBill` inmediato | No RC | **Sigue `accepted`** |

**Boleta afectada:** `documentoAfectadoId` en `CreateNoteDto` = UUID del documento.

Estados válidos boleta para NC: `signed` o `accepted`.

Estados válidos factura para NC: `accepted`.

Series seed: `FC01`/`BC01` (07), `FD01`/`BD01` (08).

---

## RC altas — selección automática

- `docType` in `03`, `07`, `08`
- `status = signed`
- `daily_summary_id IS NULL`
- `issueDate = referenceDate` (del body o hoy)
- Lock pessimista en TX al cerrar RC

**NC boleta de ayer:** NC con `issueDate` hoy → `referenceDate` RC = hoy. Boleta de ayer no entra (ya tiene `daily_summary_id`).

---

## RC void — selección manual

- `documentIds[]` explícitos
- `docType = 03`, `status = accepted`
- `daily_summary_id` no nulo
- `referenceDate` = fecha emisión boleta (= `boleta.issueDate`)
- `issueDate` = hoy
- XML: misma boleta, `ConditionCode = 3`
- `payload._rcVoid` en boleta durante envío; rollback si falla sin ticket

---

## RA — voided-documents

- `documentIds[]`: facturas `01` `accepted`
- Valida `invoice.issueDate === referenceDate`
- Correlativo RA por `(company, issueDate, summary_type=RA)`
- XML: `VoidedXmlBuilder` — `sac:DocumentSerialID`, `sac:DocumentNumberID`
- Firma: `XmlSignatureService.signVoidedDocumentsXml`
- Si falla **sin ticket**: libera `daily_summary_id` de facturas (`handleSubmitError`)
- Si falla **con ticket**: mantener enlace; reintentar `/status`

---

## Guards y concurrencia

- **RC pendiente mismo `issueDate`:** no crear RC nuevo si hay summary con ticket y status `processing`/`submitted`/`failed` → usar `/status`.
- **Correlativo RC/RA:** lock pessimista en transacción (`nextRcCorrelativo`).
- **Documentos en RC void:** lock pessimista al marcar `_rcVoid`.
- **Notas:** lock serie al incrementar correlativo.

Polling inicial: `STATUS_POLL_ATTEMPTS = 5`, `STATUS_POLL_DELAY_MS = 2000`.

---

## Estados documento

| Estado | Origen típico |
|--------|---------------|
| `signed` | Boleta, NC boleta |
| `submitted` | Transitorio sendBill |
| `accepted` | CDR OK (factura, boleta post-RC, NC factura) |
| `voided` | RC void o RA aceptado |
| `rejected` | SUNAT rechazó |
| `failed` | Error HTTP/timeout |

---

## Dev beta SUNAT

| Escenario | Acción |
|-----------|--------|
| Ticket + `getStatus` 401 | `POST /daily-summaries/:id/status` tras 1–2 min |
| `processing` | Polling manual |
| Failed sin ticket | Reenviar; docs liberados |
| Failed con ticket | Solo `/status`, no duplicar RC/RA |

SQL reset dev:

```sql
UPDATE documents SET daily_summary_id = NULL WHERE daily_summary_id = '<uuid>';
UPDATE daily_summaries SET status = 'rejected', error_message = 'Dev reset' WHERE id = '<uuid>';
```

Credenciales dev:

```
X-Api-Key: mbak_dev00000000000000000000000001
admin / admin123
Company: 00000000-0000-4000-8000-000000000001
RUC: 20000000001
```

---

## Archivos clave

| Área | Archivo |
|------|---------|
| **Base de datos** | [docs/DATABASE.md](../../../docs/DATABASE.md), [base-de-datos.md](base-de-datos.md) |
| RC service | `src/documents/daily-summaries.service.ts` |
| RC helpers | `src/documents/daily-summaries-rc.util.ts`, `daily-summaries-xml.helper.ts` |
| RA service | `src/documents/voided-documents.service.ts` |
| Docs/NC | `src/documents/documents.service.ts` |
| Controller | `src/documents/documents.controller.ts` |
| DTOs | `close-daily-summary.dto.ts`, `void-daily-summary.dto.ts`, `create-voided-documents.dto.ts`, `create-note.dto.ts` |
| UBL RC | `src/ubl/builders/summary-xml.builder.ts` |
| UBL RA | `src/ubl/builders/voided-xml.builder.ts` |
| UBL boleta/nota | `boleta-xml.builder.ts`, `note-xml.builder.ts` |
| Entity | `daily-summary.entity.ts`, `document.entity.ts` |
| SUNAT client | `src/sunat/bill-service.client.ts` |
| Roadmap | `docs/ROADMAP.md` |

---

## Skill relacionado

- [proceso-facturacion.md](proceso-facturacion.md) — flujo general
- [casos-practicos.md](casos-practicos.md) — casos 1–11 + troubleshooting beta
- [frontend-guia.md](frontend-guia.md) — pantallas y formularios
