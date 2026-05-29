import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../companies/entities/company.entity';
import { Certificate } from '../companies/entities/certificate.entity';
import { CertificateMaterial, loadPfxFromBuffer } from './pfx-loader';

@Injectable()
export class CompanyCertificateService {
  private readonly logger = new Logger(CompanyCertificateService.name);

  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
  ) {}

  async getSigningMaterial(company: Company): Promise<CertificateMaterial> {
    const certificate = await this.certificateRepository.findOne({
      where: { companyId: company.id, isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (!certificate) {
      throw new NotFoundException(
        `No active digital certificate in DB for company ${company.ruc}. Upload one via POST /v1/certificates.`,
      );
    }

    if (!certificate.pfxPassword) {
      throw new BadRequestException(
        `Certificate ${certificate.id} for ${company.ruc} has no pfx_password.`,
      );
    }

    if (!certificate.pfxContent?.length) {
      throw new NotFoundException(
        `Certificate ${certificate.id} for ${company.ruc} has no PFX content in database. Re-upload via POST /v1/certificates.`,
      );
    }

    try {
      const material = loadPfxFromBuffer(
        certificate.pfxContent,
        certificate.pfxPassword,
      );
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
}
