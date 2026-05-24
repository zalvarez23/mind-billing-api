import { registerAs } from '@nestjs/config';

export default registerAs('sunat', () => ({
  billServiceBeta:
    process.env.SUNAT_BILL_SERVICE_BETA ??
    'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
  billServiceProd:
    process.env.SUNAT_BILL_SERVICE_PROD ??
    'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
  billServiceHomologacion:
    process.env.SUNAT_BILL_SERVICE_HOMOLOGACION ??
    'https://www.sunat.gob.pe/ol-ti-itcpgem-sqa/billService',
  storagePath: process.env.STORAGE_PATH ?? './storage',
  requestTimeoutMs: parseInt(
    process.env.SUNAT_REQUEST_TIMEOUT_MS ?? '60000',
    10,
  ),
}));
