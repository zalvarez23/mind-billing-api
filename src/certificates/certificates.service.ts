import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from '../companies/entities/certificate.entity';
import { extractPfxMetadata } from '../crypto/pfx-metadata.util';
import { toCertificateResponse } from './certificate.mapper';
import { buildCertificateFileName } from './certificates-storage.util';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { ListCertificatesQueryDto } from './dto/list-certificates-query.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import {
  CertificateListResponse,
  CertificateResponse,
} from './types/certificate-response.types';

const MAX_PFX_BYTES = 2 * 1024 * 1024;

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
  ) {}

  async findAll(
    companyId: string,
    query: ListCertificatesQueryDto,
  ): Promise<CertificateListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.certificateRepository
      .createQueryBuilder('cert')
      .where('cert.companyId = :companyId', { companyId });

    if (query.isActive !== undefined) {
      qb.andWhere('cert.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('cert.createdAt', 'DESC');

    const [certificates, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: certificates.map(toCertificateResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findById(
    companyId: string,
    id: string,
  ): Promise<CertificateResponse> {
    const certificate = await this.findEntityOrThrow(companyId, id);
    return toCertificateResponse(certificate);
  }

  async create(
    companyId: string,
    pfxBuffer: Buffer,
    dto: CreateCertificateDto,
  ): Promise<CertificateResponse> {
    this.assertPfxSize(pfxBuffer);

    let metadata;
    try {
      metadata = extractPfxMetadata(pfxBuffer, dto.pfxPassword);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid PFX or password';
      throw new BadRequestException(message);
    }

    const setActive = dto.setActive !== false;
    const certificateId = crypto.randomUUID();
    const pfxFileName = buildCertificateFileName(certificateId);

    const saved = await this.certificateRepository.manager.transaction(
      async (manager) => {
        const repo = manager.getRepository(Certificate);

        if (setActive) {
          await repo.update(
            { companyId, isActive: true },
            { isActive: false },
          );
        }

        return repo.save(
          repo.create({
            id: certificateId,
            companyId,
            alias: dto.alias ?? metadata.subjectCommonName,
            pfxPath: pfxFileName,
            pfxContent: pfxBuffer,
            pfxPassword: dto.pfxPassword,
            validFrom: metadata.validFrom,
            validTo: metadata.validTo,
            isActive: setActive,
          }),
        );
      },
    );

    return toCertificateResponse(saved);
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateCertificateDto,
  ): Promise<CertificateResponse> {
    const certificate = await this.findEntityOrThrow(companyId, id);

    if (dto.pfxPassword !== undefined) {
      if (!certificate.pfxContent?.length) {
        throw new BadRequestException(
          'Certificate has no stored PFX content to validate the new password',
        );
      }
      try {
        extractPfxMetadata(certificate.pfxContent, dto.pfxPassword);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Invalid password for PFX';
        throw new BadRequestException(message);
      }
      certificate.pfxPassword = dto.pfxPassword;
    }

    if (dto.alias !== undefined) {
      certificate.alias = dto.alias;
    }

    if (dto.isActive === true) {
      await this.deactivateOthers(companyId, certificate.id);
      certificate.isActive = true;
    } else if (dto.isActive === false) {
      certificate.isActive = false;
    }

    const saved = await this.certificateRepository.save(certificate);
    return toCertificateResponse(saved);
  }

  private async deactivateOthers(
    companyId: string,
    exceptId: string,
  ): Promise<void> {
    await this.certificateRepository
      .createQueryBuilder()
      .update(Certificate)
      .set({ isActive: false })
      .where('company_id = :companyId', { companyId })
      .andWhere('id != :exceptId', { exceptId })
      .andWhere('is_active = true')
      .execute();
  }

  private assertPfxSize(buffer: Buffer): void {
    if (buffer.length === 0) {
      throw new BadRequestException('PFX file is empty');
    }
    if (buffer.length > MAX_PFX_BYTES) {
      throw new BadRequestException(
        `PFX file exceeds maximum size of ${MAX_PFX_BYTES} bytes`,
      );
    }
  }

  private async findEntityOrThrow(
    companyId: string,
    id: string,
  ): Promise<Certificate> {
    const certificate = await this.certificateRepository.findOne({
      where: { id, companyId },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    return certificate;
  }
}
