import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('v1'),
  CORS_ORIGIN: Joi.string().default('*'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SYNC: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_MIGRATIONS_RUN: Joi.boolean().truthy('true').falsy('false').default(true),
  DB_SEED_ON_START: Joi.string().valid('true', 'false', 'auto').default('auto'),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('8h'),
  STORAGE_PATH: Joi.string().default('./storage'),
  SUNAT_BILL_SERVICE_BETA: Joi.string().uri().optional(),
  SUNAT_BILL_SERVICE_PROD: Joi.string().uri().optional(),
  SUNAT_BILL_SERVICE_HOMOLOGACION: Joi.string().uri().optional(),
  SUNAT_REQUEST_TIMEOUT_MS: Joi.number().default(60000),
});
