# API Reference — mind-billing-api

Referencia HTTP para **consumir el API desde frontend** u otro cliente.

| Doc relacionada | Contenido |
|-----------------|-----------|
| [frontend-tipos-api.md](../.cursor/skills/sunat-fe/frontend-tipos-api.md) | Tipos TypeScript, enums, `BillingApiClient` |
| [frontend-guia.md](../.cursor/skills/sunat-fe/frontend-guia.md) | Pantallas y flujos UI |
| [ROADMAP.md](./ROADMAP.md) | Estado del proyecto |

**Base URL:** `http://localhost:3000/v1` (dev) — prefix configurable vía `API_PREFIX`.

---

## Autenticación

### Headers

| Header | Cuándo | Valor |
|--------|--------|-------|
| `Authorization` | Rutas protegidas | `Bearer <JWT>` |
| `Content-Type` | POST con body | `application/json` |

### Flujo recomendado en frontend

```
1. POST /auth/login  (ruc + usuario + password) → guardar accessToken
2. GET  /auth/me     (JWT)                        → perfil / validar sesión
3. Resto de calls    (JWT)
```

### Credenciales dev (seed)

```
username:  admin
password:  admin123
RUC:       20000000001
```

---

## Tipos compartidos (body de emisión)

### Cliente

```json
{
  "tipoDoc": "6",
  "numDoc": "20100066603",
  "razonSocial": "EMPRESA SAC"
}
```

Catálogo 06: `1` DNI, `6` RUC, etc.

### Ítem de línea

```json
{
  "codigo": "PROD-001",
  "descripcion": "Servicio de consultoría",
  "cantidad": 1,
  "precioUnitario": 100,
  "igv": 18
}
```

`igv` es opcional; si se omite, el backend calcula IGV 18%.

### Series dev (seed)

| docType | Uso | Series |
|---------|-----|--------|
| `01` | Factura | `F001` |
| `03` | Boleta | `B001` |
| `07` | Nota crédito | `FC01` (factura), `BC01` (boleta) |
| `08` | Nota débito | `FD01` (factura), `BD01` (boleta) |

---

## Índice de endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/login` | Obtener JWT |
| GET | `/auth/me` | Usuario y empresa actual |
| POST | `/invoices` | Emitir factura + envío SUNAT |
| POST | `/boletas` | Emitir boleta (firmada, pendiente RC) |
| POST | `/credit-notes` | Nota de crédito `07` |
| POST | `/debit-notes` | Nota de débito `08` |
| POST | `/daily-summaries` | RC altas (boletas/notas `signed`) |
| POST | `/daily-summaries/void` | RC anulación boletas |
| POST | `/voided-documents` | RA baja facturas |
| GET | `/daily-summaries/:id` | Detalle RC/RA |
| POST | `/daily-summaries/:id/status` | Polling ticket SUNAT |
| GET | `/documents` | Listado paginado |
| GET | `/documents/:id` | Detalle con payload |
| GET | `/documents/:id/xml` | XML UBL firmado |
| GET | `/documents/:id/cdr` | CDR SUNAT |

---

## Auth

### `POST /v1/auth/login`

**Headers:** solo `Content-Type` (sin JWT).

**Body:**

```json
{
  "ruc": "20000000001",
  "username": "admin",
  "password": "admin123"
}
```

**Response `200`:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "user": {
    "id": "...",
    "username": "admin",
    "fullName": "Admin Dev"
  },
  "company": {
    "id": "00000000-0000-4000-8000-000000000001",
    "ruc": "20000000001",
    "businessName": "...",
    "sunatEnvironment": "beta"
  }
}
```

```typescript
const res = await fetch('/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ruc: '20000000001',
    username: 'admin',
    password: 'admin123',
  }),
});
const { accessToken } = await res.json();
```

---

### `GET /v1/auth/me`

**Headers:** `Authorization: Bearer <JWT>`.

**Response `200`:**

```json
{
  "user": { "id": "...", "username": "admin", "fullName": "..." },
  "company": {
    "id": "...",
    "ruc": "20000000001",
    "businessName": "...",
    "tradeName": null,
    "sunatEnvironment": "beta"
  }
}
```

---

## Emisión de documentos

Todos requieren **JWT**.

### `POST /v1/invoices` — Factura `01`

Envío **síncrono** a SUNAT (`sendBill`). Respuesta incluye CDR o rechazo.

**Body:**

```json
{
  "serie": "F001",
  "tipoOperacion": "0101",
  "moneda": "PEN",
  "formaPago": "Contado",
  "cliente": {
    "tipoDoc": "6",
    "numDoc": "20100066603",
    "razonSocial": "EMPRESA SAC"
  },
  "items": [
    {
      "codigo": "SRV-001",
      "descripcion": "Consultoría",
      "cantidad": 1,
      "precioUnitario": 1000
    }
  ]
}
```

**Response `200` (aceptada):**

```json
{
  "id": "uuid-documento",
  "docType": "01",
  "serie": "F001",
  "correlativo": 1,
  "status": "accepted",
  "total": "1180.00",
  "sunat": {
    "statusCode": "0",
    "description": "La Factura ha sido aceptada",
    "accepted": true,
    "errorMessage": null
  }
}
```

Estados posibles: `accepted`, `rejected`, `failed`.

```bash
curl -X POST http://localhost:3000/v1/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"serie":"F001","tipoOperacion":"0101","moneda":"PEN","cliente":{"tipoDoc":"6","numDoc":"20100066603","razonSocial":"EMPRESA SAC"},"items":[{"codigo":"SRV-001","descripcion":"Consultoría","cantidad":1,"precioUnitario":1000}]}'
```

---

### `POST /v1/boletas` — Boleta `03`

Firma local. Estado resultante: **`signed`**. Debe incluirse en RC antes de fin de día.

**Body:** igual estructura que factura, sin `tipoOperacion` obligatorio (opcional).

```json
{
  "serie": "B001",
  "moneda": "PEN",
  "cliente": { "tipoDoc": "1", "numDoc": "12345678", "razonSocial": "JUAN PEREZ" },
  "items": [{ "codigo": "PROD-1", "descripcion": "Producto", "cantidad": 2, "precioUnitario": 50 }]
}
```

**Response `200`:**

```json
{
  "id": "uuid-boleta",
  "docType": "03",
  "serie": "B001",
  "correlativo": 5,
  "status": "signed",
  "total": "118.00",
  "issueDate": "2026-05-26",
  "message": "Boleta signed locally. Submit daily summary (RC) before end of day."
}
```

**Siguiente paso:** `POST /v1/daily-summaries` con `referenceDate` = `issueDate` de la boleta.

---

### `POST /v1/credit-notes` — Nota crédito `07`

### `POST /v1/debit-notes` — Nota débito `08`

Mismo body. Requiere documento afectado.

**Body:**

```json
{
  "serie": "BC01",
  "moneda": "PEN",
  "documentoAfectadoId": "uuid-boleta-o-factura",
  "cliente": { "tipoDoc": "6", "numDoc": "20100066603", "razonSocial": "EMPRESA SAC" },
  "items": [{ "codigo": "DEV-001", "descripcion": "Devolución", "cantidad": 1, "precioUnitario": 100 }],
  "motivoCodigo": "01",
  "motivoDescripcion": "Anulación de la operación"
}
```

**Si afecta boleta `03`:** status `signed` → incluir en RC.

```json
{
  "id": "...",
  "docType": "07",
  "status": "signed",
  "issueDate": "2026-05-26",
  "documentoAfectado": { "docType": "03", "serie": "B001", "correlativo": 5 },
  "message": "Note signed locally. Include it in the daily summary (RC)..."
}
```

**Si afecta factura `01`:** `sendBill` inmediato (como factura).

```json
{
  "id": "...",
  "docType": "07",
  "status": "accepted",
  "sunat": { "statusCode": "0", "accepted": true, ... }
}
```

---

## Resúmenes SUNAT (RC / RA)

RC y RA usan la misma tabla y el **mismo polling**: `POST /v1/daily-summaries/:id/status`.

### `POST /v1/daily-summaries` — RC altas

Incluye automáticamente boletas/notas `signed` sin RC del `referenceDate`.

**Body (todo opcional):**

```json
{
  "referenceDate": "2026-05-26",
  "issueDate": "2026-05-26"
}
```

Default de ambas fechas: **hoy**.

**Response `200`:**

```json
{
  "id": "uuid-rc",
  "summaryType": "RC",
  "summaryCode": "RC-20260526-1",
  "referenceDate": "2026-05-26",
  "issueDate": "2026-05-26",
  "status": "accepted",
  "ticket": "2026123456789",
  "sunat": { "accepted": true, "documentCount": 3 }
}
```

Estados intermedios: `processing`, `submitted` → usar `/status` para poll.

**Error con ticket (beta común):** body incluye `dailySummaryId`, `ticket`, `hint` → **no reenviar RC**, solo poll `/status`.

---

### `POST /v1/daily-summaries/void` — RC anulación boletas

Boletas `03` **accepted**, no entregadas al cliente.

**Body:**

```json
{
  "documentIds": ["uuid-boleta-1"],
  "referenceDate": "2026-05-26",
  "issueDate": "2026-05-26"
}
```

| Campo | Notas |
|-------|-------|
| `documentIds` | UUID[] obligatorio |
| `referenceDate` | Fecha emisión **original** de la boleta |
| `issueDate` | Fecha envío del RC void (default hoy) |

Tras CDR aceptado: boletas → `voided`.

---

### `POST /v1/voided-documents` — RA (baja facturas)

Solo facturas `01` en `accepted`.

**Body:**

```json
{
  "documentIds": ["uuid-factura"],
  "referenceDate": "2026-05-24",
  "issueDate": "2026-05-26",
  "motivoBaja": "ERROR EN DATOS"
}
```

`referenceDate` debe coincidir con `issueDate` de la factura.

**Response:** misma forma que RC (`dailySummaryId` en body de error o `id` en éxito). Polling: `POST /v1/daily-summaries/{id}/status`.

---

### `GET /v1/daily-summaries/:id` — Detalle RC/RA

**Response `200`:**

```json
{
  "id": "...",
  "summaryType": "RC",
  "summaryCode": "RC-20260526-1",
  "referenceDate": "2026-05-26",
  "issueDate": "2026-05-26",
  "correlativo": 1,
  "status": "accepted",
  "ticket": "2026123456789",
  "statusCode": "0",
  "errorMessage": null,
  "documentCount": 3,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### `POST /v1/daily-summaries/:id/status` — Polling

Sin body. Reconsulta ticket SUNAT. Usar para RC **y** RA.

```typescript
async function pollUntilDone(summaryId: string, token: string) {
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`/v1/daily-summaries/${summaryId}/status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.status === 'accepted' || data.status === 'rejected') return data;
    await new Promise((r) => setTimeout(r, 3000));
  }
}
```

---

## Consulta de documentos

### `GET /v1/documents` — Listado paginado

Cabeceras sin `payload` completo. Para ítems → detalle por id.

**Query params (todos opcionales):**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `issueDate` | `YYYY-MM-DD` | — | Día exacto (prioridad sobre rango) |
| `from` | `YYYY-MM-DD` | — | Inicio rango |
| `to` | `YYYY-MM-DD` | — | Fin rango |
| `docType` | `01`\|`03`\|`07`\|`08` | — | Tipo comprobante |
| `status` | string | — | `signed`, `accepted`, `voided`, etc. |
| `serie` | string | — | ej. `B001` |
| `pendingRc` | boolean | — | `true` = signed sin RC (03/07/08) |
| `page` | int | `1` | Página |
| `limit` | int | `20` | Máx `100` |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "...",
      "docType": "03",
      "serie": "B001",
      "correlativo": 5,
      "status": "signed",
      "total": "118.00",
      "issueDate": "2026-05-26",
      "dailySummaryId": null,
      "cliente": {
        "tipoDoc": "6",
        "numDoc": "20100066603",
        "razonSocial": "EMPRESA SAC"
      },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

**Ejemplos:**

```http
GET /v1/documents?issueDate=2026-05-26
GET /v1/documents?issueDate=2026-05-26&pendingRc=true
GET /v1/documents?from=2026-05-01&to=2026-05-31&docType=03&status=accepted&page=1&limit=10
```

---

### `GET /v1/documents/:id` — Detalle

Incluye **`payload`** (cliente, items, totals, documentoAfectado).

```json
{
  "id": "...",
  "docType": "03",
  "serie": "B001",
  "correlativo": 5,
  "status": "accepted",
  "total": "118.00",
  "issueDate": "2026-05-26",
  "dailySummaryId": "...",
  "payload": {
    "cliente": { "tipoDoc": "6", "numDoc": "...", "razonSocial": "..." },
    "items": [{ "codigo": "...", "descripcion": "...", "cantidad": 1, "precioUnitario": 100 }],
    "totals": { "subtotal": 100, "igvTotal": 18, "total": 118 },
    "moneda": "PEN"
  },
  "sunat": { "method": "sendSummary", "statusCode": "0", "errorMessage": null },
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### `GET /v1/documents/:id/xml`

Texto XML UBL firmado. **404** si no existe.

### `GET /v1/documents/:id/cdr`

Texto XML del CDR. **404** si boleta sin RC o SUNAT pendiente.

---

## Flujos completos (frontend)

### Boleta del día

```
POST /boletas
  → guardar id, status=signed
GET  /documents?issueDate=hoy&pendingRc=true   (opcional: verificar)
POST /daily-summaries { referenceDate: hoy }
  → si processing: POST /daily-summaries/:id/status (poll)
GET  /documents/:id                            → status=accepted
```

### Factura

```
POST /invoices
  → status=accepted|rejected en la misma respuesta
GET  /documents/:id                            → detalle / CDR
```

### NC sobre boleta entregada

```
POST /credit-notes { documentoAfectadoId, ... }
  → status=signed
POST /daily-summaries { referenceDate: fecha NC }
POST /daily-summaries/:id/status               → poll si hace falta
```

### Anular boleta no entregada

```
GET  /documents?docType=03&status=accepted     → filtrar dailySummaryId != null
POST /daily-summaries/void { documentIds, referenceDate }
POST /daily-summaries/:id/status
```

### Anular factura (RA)

```
POST /voided-documents { documentIds, referenceDate, issueDate }
POST /daily-summaries/:id/status               → id del RA en respuesta
```

---

## Errores

### Validación (`400`)

```json
{
  "statusCode": 400,
  "message": [
    { "property": "serie", "constraints": { "isNotEmpty": "serie should not be empty" } }
  ],
  "error": "Bad Request"
}
```

### Negocio / SUNAT (`400` con objeto)

```json
{
  "statusCode": 400,
  "message": {
    "message": "RC RC-20260526-1 already sent to SUNAT (ticket ...). Use POST /v1/daily-summaries/.../status",
    "dailySummaryId": "uuid",
    "ticket": "2026123456789",
    "status": "processing",
    "hint": "RC was submitted; poll status with POST /v1/daily-summaries/:id/status"
  }
}
```

**Regla UI:** si hay `ticket` en error → botón **Consultar estado**, no reenviar RC/RA.

### No autorizado (`401`) / No encontrado (`404`)

Token inválido o documento de otra empresa.

---

## Cliente API mínimo (TypeScript)

```typescript
const BASE = '/v1';

export class BillingApi {
  constructor(
    private getToken: () => string | null,
  ) {}

  private headers(json = true): HeadersInit {
    const h: Record<string, string> = {};
    const token = this.getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  login(ruc: string, username: string, password: string) {
    return fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ ruc, username, password }),
    }).then((r) => r.json());
  }

  listDocuments(params: Record<string, string | number | boolean> = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    );
    return fetch(`${BASE}/documents?${qs}`, { headers: this.headers(false) }).then(
      (r) => r.json(),
    );
  }

  getDocument(id: string) {
    return fetch(`${BASE}/documents/${id}`, { headers: this.headers(false) }).then(
      (r) => r.json(),
    );
  }

  createBoleta(body: unknown) {
    return fetch(`${BASE}/boletas`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }

  closeDailySummary(body: { referenceDate?: string; issueDate?: string } = {}) {
    return fetch(`${BASE}/daily-summaries`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }

  pollSummaryStatus(id: string) {
    return fetch(`${BASE}/daily-summaries/${id}/status`, {
      method: 'POST',
      headers: this.headers(false),
    }).then((r) => r.json());
  }
}
```

Tipos completos: [frontend-tipos-api.md](../.cursor/skills/sunat-fe/frontend-tipos-api.md).

---

## Pendiente (no expuesto aún)

| Feature | Estado |
|---------|--------|
| CRUD clientes | Tabla existe; sin endpoints |
| CRUD productos | No implementado |
| `GET /daily-summaries` (listado) | Backlog |
| Swagger / OpenAPI | Sprint 4 |

---

## Fuente de verdad en código

| Contrato | Archivo |
|----------|---------|
| Query listado | `src/documents/dto/list-documents-query.dto.ts` |
| Emisión | `src/documents/dto/create-*.dto.ts` |
| Responses | `src/documents/types/document-response.types.ts` |
| Routes | `src/documents/documents.controller.ts`, `src/auth/auth.controller.ts` |
