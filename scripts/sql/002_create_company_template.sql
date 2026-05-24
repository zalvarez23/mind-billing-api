-- =============================================================================
-- Plantilla: crear una NUEVA empresa en producción/staging
-- =============================================================================
-- 1. Reemplaza los valores marcados con <-- EDITAR
-- 2. Genera password_hash con: npm run hash:password -- "tu_password"
--    (disponible cuando se implemente Sprint 1; por ahora usa bcrypt online o node)
-- 3. Ejecuta en psql / DBeaver
-- =============================================================================

BEGIN;

WITH new_company AS (
  INSERT INTO companies (
    ruc,
    api_key,
    business_name,
    trade_name,
    address,
    ubigeo,
    sunat_environment,
    sol_username,
    sol_password,
    is_active
  ) VALUES (
    '20100066603',                                                    -- EDITAR: RUC real
    'mbak_' || encode(gen_random_bytes(16), 'hex'),                   -- API key auto-generado
    'MI EMPRESA SAC',                                                 -- EDITAR
    'Mi Empresa',                                                     -- EDITAR
    'Av. Ejemplo 123, Lima',                                          -- EDITAR
    '150101',                                                         -- EDITAR
    'beta',                                                           -- beta | homologacion | production
    '20100066603MODDATOS',                                            -- EDITAR: usuario SOL
    'MODDATOS',                                                       -- EDITAR: password SOL (beta)
    true
  )
  RETURNING id, ruc, api_key, business_name
),
new_admin AS (
  INSERT INTO users (company_id, username, password_hash, full_name, is_active)
  SELECT
    nc.id,
    'admin',                                                          -- EDITAR: username
    '$2b$10$zW7u.IDxfFkdQDx7nocnBuazSXCgxLCgg2Ned64VNIbEe9rDnsoIS',  -- EDITAR: hash de tu password
    'Administrador',
    true
  FROM new_company nc
  RETURNING username
),
new_service_user AS (
  INSERT INTO users (company_id, username, password_hash, full_name, is_active)
  SELECT
    nc.id,
    'api-svc',                                                        -- usuario M2M para tus backends
    '$2b$10$zW7u.IDxfFkdQDx7nocnBuazSXCgxLCgg2Ned64VNIbEe9rDnsoIS',  -- EDITAR: hash de tu password
    'Integración API',
    true
  FROM new_company nc
  RETURNING username
),
new_series AS (
  INSERT INTO document_series (company_id, doc_type, serie, correlativo, is_active)
  SELECT nc.id, s.doc_type, s.serie, 0, true
  FROM new_company nc
  CROSS JOIN (VALUES
    ('01', 'F001'),   -- Factura
    ('03', 'B001'),   -- Boleta
    ('07', 'FC01'),   -- Nota crédito
    ('08', 'FD01')    -- Nota débito
  ) AS s(doc_type, serie)
)
SELECT
  nc.ruc,
  nc.api_key,
  nc.business_name,
  na.username AS admin_user,
  nsu.username AS service_user
FROM new_company nc
CROSS JOIN new_admin na
CROSS JOIN new_service_user nsu;

COMMIT;
