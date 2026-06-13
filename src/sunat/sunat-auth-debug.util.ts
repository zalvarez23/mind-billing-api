import { Company } from '../companies/entities/company.entity';
import { SunatEnvironment } from '../common/enums';

export interface SunatAuthDebugInfo {
  companyId: string;
  ruc: string;
  businessName: string;
  sunatEnvironment: SunatEnvironment;
  solUsernameStored: string | null;
  soapUsernameResolved: string;
  solUserSuffix: string;
  usernameWasPrefixedWithRuc: boolean;
  hasSolPassword: boolean;
  solPasswordLength: number;
}

export function resolveSoapUsername(company: Company): string {
  if (company.sunatEnvironment === SunatEnvironment.BETA) {
    return company.solUsername ?? `${company.ruc}MODDATOS`;
  }

  if (!company.solUsername) {
    return '';
  }

  return company.solUsername.startsWith(company.ruc)
    ? company.solUsername
    : `${company.ruc}${company.solUsername}`;
}

export function buildSunatAuthDebugInfo(company: Company): SunatAuthDebugInfo {
  const soapUsernameResolved = resolveSoapUsername(company);
  const stored = company.solUsername;
  const usernameWasPrefixedWithRuc = Boolean(
    stored && !stored.startsWith(company.ruc),
  );

  return {
    companyId: company.id,
    ruc: company.ruc,
    businessName: company.businessName,
    sunatEnvironment: company.sunatEnvironment,
    solUsernameStored: stored,
    soapUsernameResolved,
    solUserSuffix: soapUsernameResolved.startsWith(company.ruc)
      ? soapUsernameResolved.slice(company.ruc.length)
      : (stored ?? ''),
    usernameWasPrefixedWithRuc,
    hasSolPassword: Boolean(company.solPassword),
    solPasswordLength: company.solPassword?.length ?? 0,
  };
}
