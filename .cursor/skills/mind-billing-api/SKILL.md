---
name: mind-billing-api
description: >-
  API REST mind-billing-api (NestJS): auth, emisión facturas/boletas/notas,
  RC/RA, consulta documentos. Usar cuando el usuario pregunte cómo consumir
  endpoints, integrar frontend, contrato HTTP, ejemplos fetch/curl, o implementar
  en el backend NestJS.
---

# mind-billing-api

API REST de facturación electrónica SUNAT Perú. Prefix global: `/v1`.

## Documentación por audiencia

| Audiencia | Archivo | Contenido |
|-----------|---------|-----------|
| **Frontend / integradores** | [docs/API-REFERENCE.md](../../../docs/API-REFERENCE.md) | **Referencia HTTP** — auth, todos los endpoints, bodies, responses, ejemplos |
| **Tipos TypeScript** | [../sunat-fe/frontend-tipos-api.md](../sunat-fe/frontend-tipos-api.md) | Interfaces TS, enums, cliente API, mapa endpoint → tipo |
| **Pantallas UI** | [../sunat-fe/frontend-guia.md](../sunat-fe/frontend-guia.md) | Qué pantalla llama qué endpoint |
| **Backend / SUNAT** | [../sunat-fe/mind-billing-api.md](../sunat-fe/mind-billing-api.md) | Implementación NestJS, SOAP, guards, archivos clave |
| **Reglas SUNAT** | [../sunat-fe/SKILL.md](../sunat-fe/SKILL.md) | RC, RA, ConditionCode, casos prácticos |
| **Base de datos** | [docs/DATABASE.md](../../../docs/DATABASE.md) | Esquema PostgreSQL |

## Regla de mantenimiento

Al **agregar o cambiar un endpoint**:

1. Implementar en `src/` (controller + DTO + service).
2. Actualizar **[docs/API-REFERENCE.md](../../../docs/API-REFERENCE.md)** (contrato HTTP + ejemplo).
3. Actualizar **[frontend-tipos-api.md](../sunat-fe/frontend-tipos-api.md)** (tipos TS).
4. Si cambia lógica SUNAT/guards → **[mind-billing-api.md](../sunat-fe/mind-billing-api.md)**.

## Auth (resumen)

```
POST /v1/auth/login     → solo X-Api-Key
Resto de rutas          → X-Api-Key + Authorization: Bearer <JWT>
```

Dev: `X-Api-Key: mbak_dev00000000000000000000000001`, login `admin` / `admin123`.

## Índice rápido de endpoints

| Método | Ruta |
|--------|------|
| POST | `/v1/auth/login` |
| GET | `/v1/auth/me` |
| POST | `/v1/invoices` |
| POST | `/v1/boletas` |
| POST | `/v1/credit-notes` |
| POST | `/v1/debit-notes` |
| POST | `/v1/daily-summaries` |
| POST | `/v1/daily-summaries/void` |
| POST | `/v1/voided-documents` |
| GET | `/v1/daily-summaries/:id` |
| POST | `/v1/daily-summaries/:id/status` |
| GET | `/v1/documents` |
| GET | `/v1/documents/:id` |
| GET | `/v1/documents/:id/xml` |
| GET | `/v1/documents/:id/cdr` |

Detalle completo: [docs/API-REFERENCE.md](../../../docs/API-REFERENCE.md).

## Archivos backend clave

| Área | Ruta |
|------|------|
| Controllers | `src/documents/documents.controller.ts`, `src/auth/auth.controller.ts` |
| Emisión | `src/documents/documents.service.ts` |
| RC | `src/documents/daily-summaries.service.ts` |
| RA | `src/documents/voided-documents.service.ts` |
| DTOs | `src/documents/dto/*`, `src/auth/dto/*` |
| Responses | `src/documents/types/document-response.types.ts` |
| SUNAT SOAP | `src/sunat/bill-service.client.ts` |
