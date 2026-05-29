import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { DEFAULT_COMPANY_SERIES } from '../common/constants/default-company-series';
import { SunatEnvironment } from '../common/enums';
import { generateTenantApiKey } from '../common/utils/generate-api-key.util';
import { DocumentSeries } from '../series/entities/document-series.entity';
import { User } from '../users/entities/user.entity';
import { toCompanyResponse } from './company.mapper';
import { CreateCompanyDto } from './dto/create-company.dto';
import { Company } from './entities/company.entity';
import { CompanyCreatedResponse } from './types/company-response.types';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async create(dto: CreateCompanyDto): Promise<CompanyCreatedResponse> {
    const existing = await this.companyRepository.findOne({
      where: { ruc: dto.ruc },
    });

    if (existing) {
      throw new ConflictException(`Company with RUC ${dto.ruc} already exists`);
    }

    const tenantApiKey = generateTenantApiKey();
    const sunatEnvironment = dto.sunatEnvironment ?? SunatEnvironment.BETA;

    return this.dataSource.transaction(async (manager) => {
      const companyRepo = manager.getRepository(Company);
      const seriesRepo = manager.getRepository(DocumentSeries);
      const userRepo = manager.getRepository(User);

      const company = await companyRepo.save(
        companyRepo.create({
          ruc: dto.ruc,
          apiKey: tenantApiKey,
          businessName: dto.businessName,
          tradeName: dto.tradeName ?? null,
          address: dto.address ?? null,
          ubigeo: dto.ubigeo ?? null,
          sunatEnvironment,
          solUsername: dto.solUsername ?? null,
          solPassword: dto.solPassword ?? null,
          isActive: true,
        }),
      );

      for (const item of DEFAULT_COMPANY_SERIES) {
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

      let initialUser: CompanyCreatedResponse['initialUser'] = null;

      if (dto.initialUser) {
        const usernameTaken = await userRepo.findOne({
          where: {
            companyId: company.id,
            username: dto.initialUser.username,
          },
        });

        if (usernameTaken) {
          throw new ConflictException(
            `Username ${dto.initialUser.username} already exists for this company`,
          );
        }

        const passwordHash = await bcrypt.hash(dto.initialUser.password, 10);
        const user = await userRepo.save(
          userRepo.create({
            companyId: company.id,
            username: dto.initialUser.username,
            passwordHash,
            fullName: dto.initialUser.fullName ?? null,
            isActive: true,
          }),
        );

        initialUser = {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
        };
      }

      return {
        company: toCompanyResponse(company),
        apiKey: tenantApiKey,
        seriesCreated: DEFAULT_COMPANY_SERIES.length,
        initialUser,
      };
    });
  }
}
