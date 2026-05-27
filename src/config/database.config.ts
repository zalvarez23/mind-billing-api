import { registerAs } from '@nestjs/config';
import {
  InitialSchema1710000000000,
  Sprint2Closure1710000000001,
  Sprint3BoletasRc1710000000002,
  Sprint3NotesRa1710000000003,
  CreateProducts1710000000004,
} from '../database/migrations';

export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'mind_billing',
  password: process.env.DB_PASSWORD ?? 'mind_billing_dev',
  database: process.env.DB_NAME ?? 'mind_billing',
  synchronize: process.env.DB_SYNC === 'true',
  logging: process.env.DB_LOGGING === 'true',
  migrationsRun: process.env.DB_MIGRATIONS_RUN !== 'false',
  seedOnStart: (() => {
    const flag = process.env.DB_SEED_ON_START ?? 'auto';
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    return process.env.NODE_ENV === 'development';
  })(),
  migrations: [
    InitialSchema1710000000000,
    Sprint2Closure1710000000001,
    Sprint3BoletasRc1710000000002,
    Sprint3NotesRa1710000000003,
    CreateProducts1710000000004,
  ],
}));
