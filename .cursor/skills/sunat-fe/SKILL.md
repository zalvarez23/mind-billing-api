---
name: sunat-fe
description: >-
  Facturación electrónica SUNAT Perú (UBL, boletas, facturas, RC, RA, NC/ND).
  Usar cuando el usuario pregunte sobre SUNAT, resumen diario, boletas 03,
  notas 07/08, anulaciones, ConditionCode, sendBill vs sendSummary, getStatus,
  homologación, flujos frontend/UI, tipos TypeScript API, contrato request/response,
  troubleshooting beta, esquema base de datos, tablas PostgreSQL, o mind-billing-api.
---

# SUNAT FE — Perú (facturación electrónica)

Referencia de reglas SUNAT, procesos implementados y decisiones de negocio para boletas, facturas, RC, RA y notas.

## Documentación del skill

| Archivo | Contenido |
|---------|-----------|
| [base-de-datos.md](base-de-datos.md) | **Esquema PostgreSQL** — tablas, FKs, estados, payload jsonb, queries |
| [proceso-facturacion.md](proceso-facturacion.md) | **Flujo general** end-to-end, dos caminos SUNAT, estados, beta vs homolog |
| [casos-practicos.md](casos-practicos.md) | Casos 1–11, checklist UI, errores comunes, troubleshooting beta |
| [frontend-tipos-api.md](frontend-tipos-api.md) | **TypeScript** — requests, responses, enums, relaciones FE, cliente API |
| [frontend-guia.md](frontend-guia.md) | Pantallas, formularios, estados, polling RC/RA |
| [mind-billing-api.md](mind-billing-api.md) | Endpoints, guards, código, archivos clave |
| [docs/ROADMAP.md](../../../docs/ROADMAP.md) | Sprints, hecho vs pendiente |

---

## Tipos de comprobante (clave)

| Código | Documento | Envío a SUNAT |
|--------|-----------|---------------|
| `01` | Factura | `sendBill` directo (CDR inmediato) |
| `03` | Boleta | **RC** (`sendSummary` + `getStatus`) |
| `07` | Nota de crédito | RC si afecta boleta; `sendBill` si afecta factura |
| `08` | Nota de débito | Igual que `07` |
| RA | Resumen de bajas | `sendSummary` — **solo facturas `01`**, no boletas |

---

## Dos caminos SUNAT (implementados)

```
sendBill (síncrono)     →  Factura 01, NC/ND sobre factura
sendSummary + getStatus →  RC (boletas 03 + notas 07/08), RA (bajas factura 01)
```

RC y RA viven en `daily_summaries` (`summary_type`: `RC` | `RA`). El polling es el mismo: `POST /v1/daily-summaries/:id/status`.

---

## RC — Resumen diario (`SummaryDocuments`)

Informa boletas y notas que no van por `sendBill`.

### ConditionCode por línea (SUNAT)

| Código | Nombre | Cuándo usar |
|--------|--------|-------------|
| **1** | Adición (alta) | Primera vez que informas el comprobante en un RC |
| **2** | Modificación | Corregir datos ya informados (**no implementado**) |
| **3** | Anulación | Boleta **ya `accepted` en RC anterior**; **no entregada** al cliente |

**Regla crítica:** `3` **no aplica** si el comprobante nunca fue aceptado en RC previo.

### Regla madre: entregada vs no entregada

| Situación | Acción |
|-----------|--------|
| **No entregada** + boleta ya `accepted` en RC | `POST /daily-summaries/void` → condition **3** |
| **No entregada** + solo `signed` (RC pendiente) | Omitir del RC; emitir boleta nueva |
| **Entregada** + boleta `accepted` | `POST /credit-notes` → RC altas con NC en **1** |
| Factura anular | `POST /voided-documents` (RA), **no** RC void |
| NC sobre factura | `POST /credit-notes` → `sendBill`; factura **sigue `accepted`** |

### Árbol de decisión — boleta

```
¿Ya enviaste RC y SUNAT aceptó la boleta (accepted)?
├─ NO (solo signed, RC pendiente)
│  ├─ No entregada, boleta mala → NO incluir en RC
│  ├─ Entregada + NC mismo día → RC con boleta + NC (ambas condition 1)
│  └─ Boleta mala + buena → solo la buena en RC (condition 1)
└─ SÍ (accepted en RC previo)
   ├─ ¿Entregada al cliente?
   │  ├─ SÍ → NC hoy (documentoAfectadoId) + RC hoy (solo NC, condition 1)
   │  └─ NO → RC void (documentIds, condition 3); boleta → voided
   └─ No usar void si hubo entrega (usar NC)
```

### Fechas RC

| Tipo RC | referenceDate | issueDate |
|---------|---------------|-----------|
| Altas | Fecha emisión docs en el RC | Fecha envío RC (típ. hoy) |
| Void | Fecha emisión **original boleta** | Fecha envío RC void (típ. hoy) |
| NC boleta de ayer | **Hoy** (fecha emisión NC) | Hoy |

---

## RA — Resumen de bajas (facturas)

- Endpoint: `POST /v1/voided-documents`
- Solo facturas `01` en estado `accepted`
- `referenceDate` debe coincidir con `issueDate` de la factura
- XML: `VoidedDocuments` con `sac:DocumentSerialID` + `sac:DocumentNumberID`
- Tras CDR: factura → `voided`
- Polling: `POST /v1/daily-summaries/:id/status` (misma tabla que RC)

---

## SUNAT beta vs homologación

| | Beta (dev) | Homologación (próximo paso) |
|---|-----------|----------------------------|
| Credenciales | `20000000001MODDATOS` / `MODDATOS` | SOL real del RUC |
| Certificado | `dev-beta.pfx` seed | `.pfx` real en `certificates` |
| `sendBill` | Suele funcionar | Estable |
| `getStatus` (RC/RA) | Intermitente (401 nginx, `processing` largo) | Más confiable |
| Acción si ticket + error poll | Reintentar `/status`, no duplicar RC/RA | Validar flujo completo |

---

## Qué NO hacer

- No marcar boleta como "rejected" en RC void — no existe ese flujo.
- No usar RA para boletas `03`.
- No void + NC sobre la misma boleta por el mismo caso.
- No re-incluir boleta `accepted` en RC nuevo (solo la NC entra).
- No crear RC/RA duplicado si ya hay ticket → usar `/status`.
- No anular factura con RC void — usar RA.

---

## Referencias externas

- [FE Primer — Resumen diario](https://fe-primer.greenter.dev/docs/resumen_diario)
