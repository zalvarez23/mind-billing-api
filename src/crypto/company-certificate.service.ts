import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { isAbsolute, join } from 'path';
import { Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { Certificate } from '../companies/entities/certificate.entity';
import { SunatEnvironment } from '../common/enums';
import { PfxBootstrapService } from './pfx-bootstrap.service';
import { CertificateMaterial, loadPfxFromFile } from './pfx-loader';

@Injectable()
export class CompanyCertificateService {
  private readonly logger = new Logger(CompanyCertificateService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly pfxBootstrap: PfxBootstrapService,
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
  ) {}

  async getSigningMaterial(company: Company): Promise<CertificateMaterial> {
    const certificate = await this.certificateRepository.findOne({
      where: { companyId: company.id, isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (!certificate?.pfxPath) {
      throw new NotFoundException(
        `No active digital certificate in DB for company ${company.ruc}.`,
      );
    }

    if (!certificate.pfxPassword) {
      throw new BadRequestException(
        `Certificate ${certificate.id} for ${company.ruc} has no pfx_password.`,
      );
    }

    const pfxPath = this.resolvePfxPath(certificate.pfxPath, company.id);

    if (company.sunatEnvironment === SunatEnvironment.BETA) {
      await this.pfxBootstrap.ensurePfxFileExists(
        pfxPath,
        certificate.pfxPassword,
        company.ruc,
        company.businessName,
      );
    }

    try {
      const material = await loadPfxFromFile(pfxPath, certificate.pfxPassword);
      this.logger.debug(`Signing with certificate ${certificate.id}`);
      return material;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load PFX';
      throw new BadRequestException(
        `Cannot load certificate for company ${company.ruc}: ${message}`,
      );
    }
  }

  private resolvePfxPath(pfxPath: string, companyId: string): string {
    if (isAbsolute(pfxPath)) {
      return pfxPath;
    }

    const storagePath = this.configService.get<string>(
      'sunat.storagePath',
      './storage',
    );

    if (pfxPath.startsWith('certs/')) {
      return join(storagePath, pfxPath);
    }

    return join(storagePath, companyId, pfxPath);
  }
}
