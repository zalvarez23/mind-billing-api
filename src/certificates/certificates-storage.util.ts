/** Nombre lógico del archivo (solo UI); el binario vive en `pfx_content`. */
export function buildCertificateFileName(certificateId: string): string {
  return `${certificateId}.pfx`;
}
