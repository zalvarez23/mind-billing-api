import { SunatEnvironment } from '../../common/enums';

export interface CompanyResponse {
  id: string;
  ruc: string;
  businessName: string;
  tradeName: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  ubigeo: string | null;
  sunatEnvironment: SunatEnvironment;
  solUsername: string | null;
  hasSolPassword: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyCreatedUserResponse {
  id: string;
  username: string;
  fullName: string | null;
}

export interface CompanyCreatedResponse {
  company: CompanyResponse;
  /** Clave tenant para integraciones; mostrar una sola vez al operador. */
  apiKey: string;
  seriesCreated: number;
  initialUser: CompanyCreatedUserResponse | null;
}
