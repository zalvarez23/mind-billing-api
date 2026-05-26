import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const CORS_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];
const CORS_HEADERS = ['Content-Type', 'Authorization', 'X-Api-Key', 'Accept'];

/** CORS_ORIGIN: `*` (default) = cualquier dominio; o lista separada por comas. */
export function buildCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGIN?.trim() || '*';

  if (raw === '*') {
    return {
      origin: true,
      methods: CORS_METHODS,
      allowedHeaders: CORS_HEADERS,
    };
  }

  return {
    origin: raw.split(',').map((o) => o.trim()).filter(Boolean),
    methods: CORS_METHODS,
    allowedHeaders: CORS_HEADERS,
  };
}
