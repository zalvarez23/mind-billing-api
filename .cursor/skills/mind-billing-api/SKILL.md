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

| Audiencia                   | Archivo                                                                | Contenido                                                                    |
| --------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Frontend / integradores** | [docs/API-REFERENCE.md](../../../docs/API-REFERENCE.md)                | **Referencia HTTP** — auth, todos los endpoints, bodies, responses, ejemplos |
| **Tipos TypeScript**        | [../sunat-fe/frontend-tipos-api.md](../sunat-fe/frontend-tipos-api.md) | Interfaces TS, enums, cliente API, mapa endpoint → tipo                      |
| **Pantallas UI**            | [../sunat-fe/frontend-guia.md](../sunat-fe/frontend-guia.md)           | Qué pantalla llama qué endpoint                                              |
| **Backend / SUNAT**         | [../sunat-fe/mind-billing-api.md](../sunat-fe/mind-billing-api.md)     | Implementación NestJS, SOAP, guards, archivos clave                          |
| **Reglas SUNAT**            | [../sunat-fe/SKILL.md](../sunat-fe/SKILL.md)                           | RC, RA, ConditionCode, casos prácticos                                       |
| **Base de datos**           | [docs/DATABASE.md](../../../docs/DATABASE.md)                          | Esquema PostgreSQL                                                           |

## Regla de mantenimiento

Al **agregar o cambiar un endpoint**:

1. Implementar en `src/` (controller + DTO + service).
2. Actualizar **[docs/API-REFERENCE.md](../../../docs/API-REFERENCE.md)** (contrato HTTP + ejemplo).
3. Actualizar **[frontend-tipos-api.md](../sunat-fe/frontend-tipos-api.md)** (tipos TS).
4. Si cambia lógica SUNAT/guards → **[mind-billing-api.md](../sunat-fe/mind-billing-api.md)**.

## Auth (resumen)

```
POST /v1/auth/login     → sin JWT
Resto de rutas          → Authorization: Bearer <JWT>
```

Dev: login `ruc: 20000000001`, `username: admin`, `password: admin123`.

## Índice rápido de endpoints

| Método | Ruta                             |
| ------ | -------------------------------- |
| POST   | `/v1/auth/login`                 |
| POST   | `/v1/admin/companies`            |
| GET    | `/v1/companies/:id`              |
| GET    | `/v1/auth/me`                    |
| POST   | `/v1/invoices`                   |
| POST   | `/v1/boletas`                    |
| POST   | `/v1/credit-notes`               |
| POST   | `/v1/debit-notes`                |
| POST   | `/v1/daily-summaries/preview`    |
| POST   | `/v1/daily-summaries`            |
| POST   | `/v1/daily-summaries/void/preview` |
| POST   | `/v1/daily-summaries/void`       |
| POST   | `/v1/voided-documents`           |
| GET    | `/v1/daily-summaries/:id`        |
| POST   | `/v1/daily-summaries/:id/status` |
| GET    | `/v1/documents`                  |
| GET    | `/v1/documents/:id`              |
| GET    | `/v1/documents/:id/xml`          |
| GET    | `/v1/documents/:id/cdr`          |
| GET    | `/v1/certificates`               |
| POST   | `/v1/certificates`             |
| PATCH  | `/v1/certificates/:id`         |
| GET    | `/v1/customers`                  |
| GET    | `/v1/customers/:id`              |
| POST   | `/v1/customers`                  |
| PATCH  | `/v1/customers/:id`              |
| GET    | `/v1/products`                   |
| GET    | `/v1/products/:id`               |
| POST   | `/v1/products`                   |
| PATCH  | `/v1/products/:id`               |
| GET    | `/v1/series`                     |
| POST   | `/v1/documents/cancel`           |

Detalle completo: [docs/API-REFERENCE.md](../../../docs/API-REFERENCE.md).

**Catálogos → emisión:** el frontend mapea `Customer` → `cliente` y `Product` + `cantidad` → `items[]` en `POST /invoices` y `POST /boletas` (ver API-REFERENCE, sección _Integración frontend_).

**Pre-RC:** `POST /documents/cancel` → `cancelled` (no SUNAT). **`voided`** = baja SUNAT post-RC (`daily-summaries/void` o RA).

## Archivos backend clave

| Área               | Ruta                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Controllers        | `src/documents/documents.controller.ts`, `src/auth/auth.controller.ts`, `src/customers/customers.controller.ts`, `src/products/products.controller.ts` |
| Catálogo clientes  | `src/customers/customers.service.ts`                                                                                                                   |
| Catálogo productos | `src/products/products.service.ts`                                                                                                                     |
| Series             | `src/series/series.service.ts`, `src/series/series.controller.ts`                                                                                      |
| Emisión            | `src/documents/documents.service.ts`                                                                                                                   |
| RC                 | `src/documents/daily-summaries.service.ts`                                                                                                             |
| RA                 | `src/documents/voided-documents.service.ts`                                                                                                            |
| DTOs               | `src/documents/dto/*`, `src/auth/dto/*`                                                                                                                |
| Responses          | `src/documents/types/document-response.types.ts`                                                                                                       |
| SUNAT SOAP         | `src/sunat/bill-service.client.ts`                                                                                                                     |
