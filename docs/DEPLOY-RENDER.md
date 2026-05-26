# Despliegue en Render

Guía para publicar **mind-billing-api** (NestJS + PostgreSQL) en [Render](https://render.com).

## Requisitos

- Repo en GitHub: `zalvarez23/mind-billing-api`
- Cuenta en Render con acceso al repositorio

## Opción A — Blueprint (recomendada)

1. En Render: **New** → **Blueprint**.
2. Conecta GitHub y elige el repo `mind-billing-api`.
3. Render detecta `render.yaml` y crea:
   - **PostgreSQL** (`mind-billing-db`)
   - **Web Service** (`mind-billing-api`)
4. Confirma el deploy. La primera vez puede tardar varios minutos (`npm ci` + `nest build` + migraciones).

URL de la API: `https://mind-billing-api.onrender.com` (o el subdominio que asigne Render).  
Prefijo de rutas: `/v1` (ej. `GET /v1/health`).

## Opción B — Manual

### 1. Base de datos

**New** → **PostgreSQL** → nombre `mind-billing-db`, plan Free.

Anota **Internal Database URL** (la usa el web service en la misma región).

### 2. Web Service

**New** → **Web Service** → conecta el repo, rama `main`.

| Campo | Valor |
|--------|--------|
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm run start:prod` |
| Health Check Path | `/v1/health` |

### 3. Variables de entorno

Copia desde el Postgres (pestaña **Connections** → campos individuales) y añade:

```env
NODE_ENV=production
API_PREFIX=v1
PORT=10000

DB_HOST=<desde Render>
DB_PORT=5432
DB_USER=<desde Render>
DB_PASSWORD=<desde Render>
DB_NAME=mind_billing

DB_SYNC=false
DB_LOGGING=false
DB_MIGRATIONS_RUN=true
DB_SEED_ON_START=false

JWT_SECRET=<mínimo 16 caracteres aleatorios>
JWT_EXPIRES_IN=8h

STORAGE_PATH=./storage
SUNAT_BILL_SERVICE_BETA=https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService
```

`PORT` lo inyecta Render automáticamente; no hace falta fijarlo salvo pruebas locales.

### 4. Deploy

Guarda → Render construye y arranca. Las **migraciones** corren al iniciar (`DB_MIGRATIONS_RUN=true`).

## Probar

```bash
curl https://<tu-servicio>.onrender.com/v1/health
# {"status":"ok"}

curl -X POST https://<tu-servicio>.onrender.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.pe","password":"admin123"}'
```

El usuario demo solo existe si ejecutaste seed en algún momento (`DB_SEED_ON_START=true` una vez, o `npm run db:seed` en un shell de Render). En producción deja `DB_SEED_ON_START=false` y carga empresas/certificados reales en BD.

## Certificados SUNAT (beta / prod)

- Rutas PFX bajo `STORAGE_PATH` (disco **efímero** en Render: se pierde al redeploy salvo que uses disco persistente o S3).
- En beta, el seed puede generar `certs/dev-beta.pfx` si no existe.
- En producción: sube el `.pfx` al volumen o inserta en `certificates` y asegura que el archivo exista en `STORAGE_PATH`.

## Plan Free — limitaciones

- El web service **se duerme** tras inactividad; el primer request puede tardar ~30–60 s.
- Postgres Free expira a los 90 días (Render avisa antes).

## Logs y fallos

- **Build failed**: revisa `npm run build` en logs.
- **App crashed**: suele ser `JWT_SECRET` corto, BD inalcanzable o validación Joi de env vars.
- **502 en health**: espera a que termine el build; en cold start la app tarda en levantar.

## Actualizar

Push a `main` → Render redeploy automático si activaste **Auto-Deploy**.
