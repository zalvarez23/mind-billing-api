import { randomBytes } from 'crypto';

export function generateTenantApiKey(): string {
  return `mbak_${randomBytes(24).toString('hex')}`;
}
