import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import dataSource from '../data-source';
import { SunatDocumentType } from '../../catalog/entities/sunat-document-type.entity';
import { Company } from '../../companies/entities/company.entity';
import { Certificate } from '../../companies/entities/certificate.entity';
import { User } from '../../users/entities/user.entity';
import { DocumentSeries } from '../../series/entities/document-series.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { SunatEnvironment } from '../../common/enums';

export const DEV_COMPANY_ID = '00000000-0000-4000-8000-000000000001';
export const DEV_ADMIN_ID = '00000000-0000-4000-8000-000000000010';
export const DEV_API_SVC_ID = '00000000-0000-4000-8000-000000000011';
export const DEV_COMPANY_RUC = '20000000001';
export const DEV_API_KEY = 'mbak_dev00000000000000000000000001';
export const DEV_PASSWORD = 'admin123';
export const DEV_PFX_PATH = 'certs/dev-beta.pfx';
export const DEV_PFX_PASSWORD = 'dev-beta123';

const SUNAT_DOCUMENT_TYPES = [
  { code: '01', name: 'Factura', description: 'Factura electrónica' },
  {
    code: '03',
    name: 'Boleta de venta',
    description: 'Boleta de venta electrónica',
  },
  {
    code: '07',
    name: 'Nota de crédito',
    description: 'Nota de crédito electrónica',
  },
  {
    code: '08',
    name: 'Nota de débito',
    description: 'Nota de débito electrónica',
  },
  {
    code: '09',
    name: 'Guía remisión remitente',
    description: 'Guía de remisión electrónica - remitente',
  },
  {
    code: '31',
    name: 'Guía remisión transportista',
    description: 'Guía de remisión electrónica - transportista',
  },
  {
    code: '20',
    name: 'Retención',
    description: 'Comprobante de retención electrónico',
  },
  {
    code: '40',
    name: 'Percepción',
    description: 'Comprobante de percepción electrónico',
  },
];

const DEV_SERIES = [
  { docType: '01', serie: 'F001' },
  { docType: '03', serie: 'B001' },
  { docType: '07', serie: 'FC01' },
  { docType: '08', serie: 'FD01' },
];

const DEV_CUSTOMERS = [
  {
    docType: '6',
    docNumber: '20100066603',
    legalName: 'CLIENTE CORPORATIVO SAC',
    email: 'facturacion@cliente-demo.pe',
    address: 'Jr. Comercio 456, Lima',
    ubigeo: '150102',
  },
  {
    docType: '1',
    docNumber: '45678912',
    legalName: 'JUAN PEREZ GARCIA',
    email: 'juan.perez@email.com',
    address: 'Calle Falsa 123, Lima',
    ubigeo: '150103',
  },
  {
    docType: '6',
    docNumber: '20555555555',
    legalName: 'PROVEEDOR TEST EIRL',
    email: 'contacto@proveedor-test.pe',
    address: 'Av. Industrial 789, Lima',
    ubigeo: '150104',
  },
];

export async function runSeed(connection: DataSource): Promise<void> {
  const docTypeRepo = connection.getRepository(SunatDocumentType);
  const companyRepo = connection.getRepository(Company);
  const userRepo = connection.getRepository(User);
  const seriesRepo = connection.getRepository(DocumentSeries);
  const customerRepo = connection.getRepository(Customer);
  const certificateRepo = connection.getRepository(Certificate);

  for (const item of SUNAT_DOCUMENT_TYPES) {
    const existing = await docTypeRepo.findOne({ where: { code: item.code } });
    if (!existing) {
      await docTypeRepo.save(docTypeRepo.create(item));
    }
  }
  console.log('✓ Catálogo SUNAT document types');

  let company = await companyRepo.findOne({ where: { ruc: DEV_COMPANY_RUC } });
  if (!company) {
    company = await companyRepo.save(
      companyRepo.create({
        id: DEV_COMPANY_ID,
        ruc: DEV_COMPANY_RUC,
        apiKey: DEV_API_KEY,
        businessName: 'EMPRESA DEV SAC',
        tradeName: 'Empresa Dev',
        address: 'Av. Dev 123, Lima',
        ubigeo: '150101',
        sunatEnvironment: SunatEnvironment.BETA,
        solUsername: '20000000001MODDATOS',
        solPassword: 'MODDATOS',
        isActive: true,
      }),
    );
    console.log('✓ Empresa dev creada');
  } else {
    console.log('→ Empresa dev ya existe, skipping');
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const devUsers = [
    {
      id: DEV_ADMIN_ID,
      username: 'admin',
      fullName: 'Administrador Dev',
    },
    {
      id: DEV_API_SVC_ID,
      username: 'api-svc',
      fullName: 'Usuario de servicio (M2M)',
    },
  ];

  for (const devUser of devUsers) {
    const existingUser = await userRepo.findOne({
      where: { companyId: company.id, username: devUser.username },
    });
    if (!existingUser) {
      await userRepo.save(
        userRepo.create({
          id: devUser.id,
          companyId: company.id,
          username: devUser.username,
          passwordHash,
          fullName: devUser.fullName,
          isActive: true,
        }),
      );
      console.log(`✓ Usuario ${devUser.username} creado`);
    }
  }

  for (const item of DEV_SERIES) {
    const existingSeries = await seriesRepo.findOne({
      where: {
        companyId: company.id,
        docType: item.docType,
        serie: item.serie,
      },
    });
    if (!existingSeries) {
      await seriesRepo.save(
        seriesRepo.create({
          companyId: company.id,
          docType: item.docType,
          serie: item.serie,
          correlativo: 0,
          isActive: true,
        }),
      );
    }
  }
  console.log('✓ Series de documentos');

  const existingCert = await certificateRepo.findOne({
    where: { companyId: company.id, isActive: true },
  });
  if (!existingCert) {
    await certificateRepo.save(
      certificateRepo.create({
        companyId: company.id,
        alias: 'dev-beta',
        pfxPath: DEV_PFX_PATH,
        pfxPassword: DEV_PFX_PASSWORD,
        isActive: true,
      }),
    );
    console.log(`✓ Certificado en certificates (${DEV_PFX_PATH})`);
  } else {
    console.log('→ Certificado ya existe en BD, skipping');
  }

  for (const item of DEV_CUSTOMERS) {
    const existingCustomer = await customerRepo.findOne({
      where: {
        companyId: company.id,
        docType: item.docType,
        docNumber: item.docNumber,
      },
    });
    if (!existingCustomer) {
      await customerRepo.save(
        customerRepo.create({
          companyId: company.id,
          ...item,
          isActive: true,
        }),
      );
    }
  }
  console.log('✓ Clientes demo');

  console.log('\n--- Credenciales dev ---');
  console.log(`X-Api-Key: ${DEV_API_KEY}`);
  console.log('Usuarios: admin / admin123  |  api-svc / admin123');
  console.log('------------------------\n');
}
async function main(): Promise<void> {
  const connection = dataSource.isInitialized
    ? dataSource
    : await dataSource.initialize();

  try {
    await runSeed(connection);
  } finally {
    if (connection.isInitialized) {
      await connection.destroy();
    }
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
