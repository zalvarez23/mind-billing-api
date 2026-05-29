import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { entities } from './entities';
import {
  InitialSchema1710000000000,
  Sprint2Closure1710000000001,
  Sprint3BoletasRc1710000000002,
  Sprint3NotesRa1710000000003,
  CreateProducts1710000000004,
  CertificatePfxContent1710000000005,
} from './migrations';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'mind_billing',
  password: process.env.DB_PASSWORD ?? 'mind_billing_dev',
  database: process.env.DB_NAME ?? 'mind_billing',
  entities,
  migrations: [
    InitialSchema1710000000000,
    Sprint2Closure1710000000001,
    Sprint3BoletasRc1710000000002,
    Sprint3NotesRa1710000000003,
    CreateProducts1710000000004,
    CertificatePfxContent1710000000005,
  ],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
