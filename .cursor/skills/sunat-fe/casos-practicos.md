# Casos prácticos — boletas, RC, NC y anulaciones

Referencia para desarrollo de **frontend/UI** y para agentes que implementen flujos en `mind-billing-api`.
Ver también [proceso-facturacion.md](proceso-facturacion.md), [frontend-guia.md](frontend-guia.md) y [mind-billing-api.md](mind-billing-api.md).

---

## Regla madre: ¿entregada al cliente?

| ¿Entregaste la boleta al cliente? | Mecanismo | Endpoint API |
|-----------------------------------|-----------|--------------|
| **No** (error interno, no salió al cliente) | Anulación RC (`ConditionCode = 3`) si ya está `accepted` en RC | `POST /v1/daily-summaries/void` |
| **No** y RC **aún no enviado** | Omitir boleta mala del RC; emitir boleta nueva | `POST /v1/daily-summaries` (solo la buena) |
| **Sí** (PDF, impreso, email, etc.) | Nota de crédito `07` + RC altas | `POST /v1/credit-notes` → `POST /v1/daily-summaries` |
| Factura `01` entregada y anular | RA (no RC void) | `POST /v1/voided-documents` |

**No mezclar** void (`3`) y NC sobre la misma boleta por el mismo motivo. Son caminos excluyentes según negocio.

---

## Fechas: `referenceDate` vs `issueDate` (RC)

| Campo | Significado SUNAT | RC altas (normal) | RC void (anulación) |
|-------|-------------------|-------------------|---------------------|
| `referenceDate` | Fecha de **emisión** de los comprobantes en las líneas | Fecha de boletas/NC `signed` pendientes (filtro `issueDate` en BD) | Fecha de **emisión original** de las boletas a anular (debe coincidir con `boleta.issueDate`) |
| `issueDate` | Fecha en que **generas/envías** el RC | Hoy (típico) | Hoy (típico; día posterior a la boleta) |

**RC void:** `referenceDate` = ayer (boleta), `issueDate` = hoy (envío del RC de baja).

**RC con NC de boleta de ayer:** `referenceDate` = **hoy** (fecha de emisión de la NC), no ayer. La boleta de ayer no vuelve al RC.

---

## Caso 1: Boleta mala, RC no enviado, **no entregada**

**Estado:** boleta `signed`, `daily_summary_id` null.

| Acción | Detalle |
|--------|---------|
| Boleta mala B001-1 | **No incluir** en RC |
| Boleta buena B001-2 | RC altas → condition **1** |
| UI | Checkbox/selección de qué boletas van al cierre del día; excluir las malas |

---

## Caso 2: Boleta + NC **mismo día** (ambas antes del RC)

**Estado:** boleta `signed`, NC `signed`, mismo `issueDate`, sin RC.

| Línea RC | Condition | Notas |
|----------|-----------|-------|
| Boleta `03` | **1** | Alta |
| NC `07` | **1** | `BillingReference` → boleta |

**API:** una sola `POST /v1/daily-summaries` con `referenceDate` = hoy.

**UI:** tras crear NC, ambos aparecen en pantalla “Cerrar RC del día”.

---

## Caso 3: Boleta `accepted` **ayer**, NC **hoy** (entregada → devolución)

**Escenario:** hubo entrega al cliente; al día siguiente se revierte con NC.

| Paso | API | Detalle |
|------|-----|---------|
| 1 | `POST /v1/credit-notes` | `documentoAfectadoId` = UUID boleta `accepted` de ayer |
| 2 | `POST /v1/daily-summaries` | `referenceDate` = **hoy**; solo entra la NC (`07` `signed`) |
| RC línea NC | condition **1** | `BillingReference` apunta a boleta de ayer |
| Boleta ayer | Sin cambio | Sigue `accepted`; **no** se re-informa en RC |

**UI:**

- Pantalla “Emitir NC” → buscar boletas `accepted` por fecha/serie.
- Tras NC → “Enviar RC” del día con `referenceDate` automático = hoy.
- No ofrecer “Anular boleta” (void) si el usuario marcó “entregada”.

---

## Caso 4: Boleta `accepted` **ayer**, anular **hoy** (**no entregada**)

**Escenario:** RC de ayer salió OK pero la boleta nunca debió existir / no se entregó.

| Paso | API | Detalle |
|------|-----|---------|
| 1 | `POST /v1/daily-summaries/void` | `documentIds[]` = UUIDs seleccionados en UI |
| RC línea boleta | condition **3** | Misma serie/correlativo/montos; **no** es NC |
| `referenceDate` | Fecha emisión boleta (ayer) | Opcional si todas tienen `issueDate` en BD |
| `issueDate` | Hoy | Fecha del RC de anulación |
| Resultado | Boleta → `voided` | Tras CDR aceptado |

**Qué envía el XML:** la **boleta `03`** con código **3**, no una nota de crédito.

**UI:**

- Multi-select de boletas `accepted` con `daily_summary_id` no null.
- Pregunta explícita: “¿Se entregó al cliente?” → Si **no** → void; Si **sí** → NC (Caso 3).
- Nueva boleta correcta: emitir con **nuevo correlativo**; RC de hoy con condition **1**.

---

## Caso 5: ¿La NC solo después del RC de la boleta?

| Estado boleta | Cuándo crear NC | Cuándo informar NC |
|---------------|-----------------|-------------------|
| `signed` (RC pendiente) | Mismo día | Mismo RC que la boleta (Caso 2) |
| `accepted` (RC ya aceptado) | Cualquier día posterior | RC del día de emisión de la NC (Caso 3) |

---

## Caso 6: RC altas vs RC void (tabla API)

| | RC altas | RC void | RA (facturas) |
|---|----------|---------|---------------|
| Endpoint | `POST /v1/daily-summaries` | `POST /v1/daily-summaries/void` | `POST /v1/voided-documents` |
| Tipos doc | `03`, `07`, `08` | solo `03` | solo `01` |
| Selección | Auto: `signed` + sin RC + `issueDate` | Manual: `documentIds[]` | Manual: facturas `accepted` |
| Estado doc entrada | `signed` | `accepted` + ya tuvo RC | `accepted` |
| ConditionCode | `1` | `3` | N/A |
| Estado doc salida | `accepted` | `voided` | `voided` |

---

## Caso 7: Boleta mala + boleta buena, **mismo día**, RC pendiente

- B001-1 mala → omitir del RC.
- B001-2 buena → RC condition **1**.
- **No** usar void: la mala nunca fue `accepted` en SUNAT.

---

## Caso 8: Error en datos pero venta real (entregada)

- **No** void.
- NC por diferencia o total según caso; opcional nueva boleta correcta.
- RC de hoy con NC en condition **1**.

---

## Caso 9: Factura `01` anular (no boleta)

- Usar **RA** (`voided-documents`), no RC void.
- Boletas **nunca** van por RA.
- `referenceDate` = `issueDate` de la factura.
- Polling: `POST /v1/daily-summaries/:id/status` (RA en misma tabla que RC).

---

## Caso 10: NC sobre factura `01` (devolución / anulación parcial)

**Escenario:** factura ya `accepted` en SUNAT; se emite nota de crédito.

| Paso | API | Detalle |
|------|-----|---------|
| 1 | `POST /v1/credit-notes` | `documentoAfectadoId` = UUID factura; serie `FC01` |
| 2 | Automático | `sendBill` — CDR inmediato |
| NC | `accepted` / `rejected` | Según CDR |
| Factura original | **Sigue `accepted`** | SUNAT no la voided por NC; la NC es documento aparte |

**UI:** pantalla NC factura separada de NC boleta. No pedir RC tras NC factura.

**Anulación total factura:** preferir RA (`voided-documents`), no NC 100% salvo política contable distinta.

---

## Caso 11: RA factura — envío y polling (lo probado en dev)

| Paso | Detalle |
|------|---------|
| Precondición | Factura `01` `accepted`, `daily_summary_id` null |
| Envío | `POST /v1/voided-documents` con `documentIds[]` |
| SUNAT | `sendSummary` → ticket → `getStatus` |
| Éxito | Factura → `voided`, RA → `accepted` |
| Beta | A veces `sendSummary` OK pero `getStatus` 401 → **reintentar `/status`**, no crear RA nuevo |
| Sin ticket | API libera `daily_summary_id` de la factura automáticamente |

**XML RA (fix aplicado):** líneas usan `sac:DocumentSerialID` + `sac:DocumentNumberID`, no `<cbc:ID>F001-12</cbc:ID>`.

---

## Troubleshooting SUNAT beta (RC y RA)

| Síntoma | Interpretación | Qué hacer |
|---------|----------------|-----------|
| Ticket recibido + error `getStatus` 401 nginx | Proxy SUNAT beta; envío **sí llegó** | Esperar 1–2 min; `POST /daily-summaries/:id/status` |
| RC/RA `processing` | Código SUNAT `98` | Polling manual |
| `failed` sin ticket | Envío no llegó | Reintentar envío; factura/boleta liberada si RA |
| `failed` con ticket | Poll falló | **No** duplicar; solo `/status` |
| `sendBill` OK, RC/RA mal | Normal en beta | Validar en homologación |

```bash
# Polling RC o RA (mismo endpoint)
POST /v1/daily-summaries/{dailySummaryId}/status
```

SQL reset dev (solo si abandonas un RC/RA atascado):

```sql
UPDATE documents SET daily_summary_id = NULL WHERE daily_summary_id = '<uuid>';
UPDATE daily_summaries SET status = 'rejected', error_message = 'Dev reset' WHERE id = '<uuid>';
```

---

## ConditionCode — solo existen 1, 2, 3

| Código | Uso en mind-billing-api hoy |
|--------|----------------------------|
| `1` | Implementado (RC altas) |
| `2` | No implementado (modificación) — backlog si SUNAT lo exige |
| `3` | Implementado (RC void boletas) |

---

## Checklist rápido para UI/UX

```
Usuario quiere revertir una boleta accepted
│
├─ ¿Entregada al cliente?
│  ├─ NO  → ¿Void disponible? (accepted + daily_summary_id)
│  │        └─ SÍ → POST /daily-summaries/void (documentIds)
│  │        └─ Emitir nueva boleta si aplica
│  │
│  └─ SÍ  → POST /credit-notes (documentoAfectadoId)
│           → POST /daily-summaries (referenceDate = hoy)
│
└─ ¿Solo firmada, sin RC?
   ├─ Mala no entregada → excluir del RC
   └─ NC mismo día → RC con boleta + NC (ambas condition 1)
```

---

## Errores comunes (evitar en frontend)

| Error | Por qué está mal |
|-------|------------------|
| Void sobre boleta entregada | Debe ser NC, no condition `3` |
| NC + void misma boleta | Caminos excluyentes |
| `referenceDate` ayer al cerrar RC con NC emitida hoy | El RC filtra por `issueDate` de la NC (= hoy) |
| Re-incluir boleta `accepted` en RC de hoy | Ya tiene `daily_summary_id`; solo va la NC |
| RA para boleta `03` | RA es solo facturas |
| RC void para factura `01` | Usar RA (`voided-documents`) |
| Crear RC/RA nuevo con ticket pendiente | Usar `POST .../status` |
| `documentIds` en void con NC o factura | Void solo acepta boletas `03` `accepted` |

---

## Motivos SUNAT en NC (referencia UI)

Campos opcionales en `CreateNoteDto`: `motivoCodigo`, `motivoDescripcion`.

Ejemplos habituales (catálogo SUNAT): `01` anulación de la operación, `06` devolución total, `07` devolución parcial. Validar catálogo vigente con contabilidad.

---

## Secuencia API resumida (copiar en tickets frontend)

**NC boleta de ayer (entregada):**
1. `POST /v1/credit-notes` — body con `documentoAfectadoId` (UUID)
2. `POST /v1/daily-summaries` — `{ "referenceDate": "YYYY-MM-DD-hoy", "issueDate": "YYYY-MM-DD-hoy" }`
3. `POST /v1/daily-summaries/:id/status` — polling hasta `accepted`

**Void boleta de ayer (no entregada):**
1. `POST /v1/daily-summaries/void` — `{ "documentIds": ["uuid..."], "issueDate": "hoy" }`
2. `POST /v1/daily-summaries/:id/status` — polling hasta boletas `voided`

**Anular factura (RA):**
1. `POST /v1/voided-documents` — `{ "documentIds": ["uuid-factura"], "referenceDate": "fecha-emision-factura" }`
2. `POST /v1/daily-summaries/:id/status` — polling hasta factura `voided`

**NC factura (sin RC):**
1. `POST /v1/credit-notes` — `documentoAfectadoId` + serie `FC01`
2. Respuesta incluye CDR; factura original sigue `accepted`
