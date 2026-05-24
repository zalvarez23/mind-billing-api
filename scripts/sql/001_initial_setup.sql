-- =============================================================================
-- mind-billing-api — Setup manual (PostgreSQL) — BACKUP / REFERENCIA
-- =============================================================================
-- NOTA: El flujo normal del proyecto usa TypeORM:
--   npm run db:setup   →  migration:run (tablas) + db:seed (datos base, idempotente)
-- Usa este archivo solo si prefieres psql directo o para debugging.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. SCHEMA
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Catálogo SUNAT N° 01 — tipos de comprobante (referencia, no cambia por empresa)
CREATE TABLE IF NOT EXISTS sunat_document_types (
  code        VARCHAR(2)  PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

-- Empresas emisoras (multi-tenant)
CREATE TABLE IF NOT EXISTS companies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruc               VARCHAR(11)  NOT NULL UNIQUE,
  api_key           VARCHAR(64)  NOT NULL UNIQUE,
  business_name     VARCHAR(255) NOT NULL,
  trade_name        VARCHAR(255),
  address           VARCHAR(500),
  ubigeo            VARCHAR(6),
  sunat_environment VARCHAR(20)  NOT NULL DEFAULT 'beta'
    CHECK (sunat_environment IN ('beta', 'homologacion', 'production')),
  sol_username      VARCHAR(100),
  sol_password      VARCHAR(100),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_api_key ON companies (api_key) WHERE is_active = true;

-- Usuarios (1 usuario → 1 empresa)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  username      VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, username)
);

CREATE INDEX IF NOT EXISTS idx_users_company_id ON users (company_id);

-- Series de documentos por empresa (F001, B001, etc.)
CREATE TABLE IF NOT EXISTS document_series (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  doc_type    VARCHAR(2) NOT NULL REFERENCES sunat_document_types (code),
  serie       VARCHAR(4) NOT NULL,
  correlativo INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, doc_type, serie)
);

-- Clientes / compradores (adquirientes) — por empresa
CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  doc_type        VARCHAR(1) NOT NULL DEFAULT '6',  -- Cat. 06: 1=DNI, 6=RUC, 0=Sin doc
  doc_number      VARCHAR(15) NOT NULL,
  legal_name      VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  address         VARCHAR(500),
  ubigeo          VARCHAR(6),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, doc_type, doc_number)
);

CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers (company_id);

-- Certificados digitales (opcional al inicio; vacío hasta homologación/prod)
CREATE TABLE IF NOT EXISTS certificates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  alias        VARCHAR(100),
  pfx_path     VARCHAR(500),
  pfx_password VARCHAR(255),
  valid_from   DATE,
  valid_to     DATE,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. CATÁLOGO SUNAT — Tipos de documento (Cat. 01)
-- ---------------------------------------------------------------------------

INSERT INTO sunat_document_types (code, name, description) VALUES
  ('01', 'Factura',              'Factura electrónica'),
  ('03', 'Boleta de venta',      'Boleta de venta electrónica'),
  ('07', 'Nota de crédito',      'Nota de crédito electrónica'),
  ('08', 'Nota de débito',       'Nota de débito electrónica'),
  ('09', 'Guía remisión remitente', 'Guía de remisión electrónica - remitente'),
  ('31', 'Guía remisión transportista', 'Guía de remisión electrónica - transportista'),
  ('20', 'Retención',            'Comprobante de retención electrónico'),
  ('40', 'Percepción',           'Comprobante de percepción electrónico')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. EMPRESA + USUARIOS + SERIES (desarrollo / beta SUNAT)
-- ---------------------------------------------------------------------------
-- API key fijo para dev: mbak_dev00000000000000000000000001
-- Usuarios:
--   admin / admin123
--   api-svc / admin123  (cuenta de servicio para integraciones M2M)
-- Password hash: bcrypt cost 10 de "admin123"
-- Regenerar con: npm run hash:password -- "tu_password"  (cuando exista el script)

INSERT INTO companies (
  id, ruc, api_key, business_name, trade_name, address, ubigeo,
  sunat_environment, sol_username, sol_password, is_active
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  '20000000001',
  'mbak_dev00000000000000000000000001',
  'EMPRESA DEV SAC',
  'Empresa Dev',
  'Av. Dev 123, Lima',
  '150101',
  'beta',
  '20000000001MODDATOS',
  'MODDATOS',
  true
)
ON CONFLICT (ruc) DO UPDATE SET
  api_key           = EXCLUDED.api_key,
  business_name     = EXCLUDED.business_name,
  sunat_environment = EXCLUDED.sunat_environment,
  sol_username      = EXCLUDED.sol_username,
  sol_password      = EXCLUDED.sol_password,
  updated_at        = NOW();

INSERT INTO users (id, company_id, username, password_hash, full_name, is_active)
VALUES
  (
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000001',
    'admin',
    '$2b$10$zW7u.IDxfFkdQDx7nocnBuazSXCgxLCgg2Ned64VNIbEe9rDnsoIS',
    'Administrador Dev',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000001',
    'api-svc',
    '$2b$10$zW7u.IDxfFkdQDx7nocnBuazSXCgxLCgg2Ned64VNIbEe9rDnsoIS',
    'Usuario de servicio (M2M)',
    true
  )
ON CONFLICT (company_id, username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name     = EXCLUDED.full_name,
  is_active     = EXCLUDED.is_active,
  updated_at    = NOW();

INSERT INTO document_series (company_id, doc_type, serie, correlativo, is_active)
SELECT
  '00000000-0000-4000-8000-000000000001',
  s.doc_type,
  s.serie,
  0,
  true
FROM (VALUES
  ('01', 'F001'),
  ('03', 'B001'),
  ('07', 'FC01'),
  ('08', 'FD01')
) AS s(doc_type, serie)
ON CONFLICT (company_id, doc_type, serie) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. CLIENTES DE EJEMPLO (compradores para pruebas de factura/boleta)
-- ---------------------------------------------------------------------------

INSERT INTO customers (company_id, doc_type, doc_number, legal_name, email, address, ubigeo)
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    '6',
    '20100066603',
    'CLIENTE CORPORATIVO SAC',
    'facturacion@cliente-demo.pe',
    'Jr. Comercio 456, Lima',
    '150102'
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '1',
    '45678912',
    'JUAN PEREZ GARCIA',
    'juan.perez@email.com',
    'Calle Falsa 123, Lima',
    '150103'
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '6',
    '20555555555',
    'PROVEEDOR TEST EIRL',
    'contacto@proveedor-test.pe',
    'Av. Industrial 789, Lima',
    '150104'
  )
ON CONFLICT (company_id, doc_type, doc_number) DO UPDATE SET
  legal_name = EXCLUDED.legal_name,
  email      = EXCLUDED.email,
  address    = EXCLUDED.address,
  updated_at = NOW();

COMMIT;

-- ---------------------------------------------------------------------------
-- RESULTADO — copia estos valores para probar la API
-- ---------------------------------------------------------------------------
SELECT
  c.ruc,
  c.api_key,
  c.business_name,
  c.sunat_environment,
  u.username,
  'admin123' AS password_plaintext_dev_only
FROM companies c
JOIN users u ON u.company_id = c.id
WHERE c.ruc = '20000000001'
ORDER BY u.username;
