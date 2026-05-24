import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { API_KEY_HEADER, REQUEST_COMPANY_KEY } from '../../common/constants';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers[API_KEY_HEADER];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    const company = await this.companyRepository.findOne({
      where: { apiKey, isActive: true },
    });

    if (!company) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    (request as Request & { [REQUEST_COMPANY_KEY]: Company })[
      REQUEST_COMPANY_KEY
    ] = company;

    return true;
  }
}
