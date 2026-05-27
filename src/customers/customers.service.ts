import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toCustomerResponse } from './customer.mapper';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './entities/customer.entity';
import {
  CustomerListResponse,
  CustomerResponse,
} from './types/customer-response.types';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  async findAll(
    companyId: string,
    query: ListCustomersQueryDto,
  ): Promise<CustomerListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.customerRepository
      .createQueryBuilder('c')
      .where('c.companyId = :companyId', { companyId });

    if (query.docType) {
      qb.andWhere('c.docType = :docType', { docType: query.docType });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('c.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.q) {
      qb.andWhere('(c.docNumber ILIKE :q OR c.legalName ILIKE :q)', {
        q: `%${query.q}%`,
      });
    }

    qb.orderBy('c.legalName', 'ASC').addOrderBy('c.docNumber', 'ASC');

    const [customers, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: customers.map(toCustomerResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async findById(companyId: string, id: string): Promise<CustomerResponse> {
    const customer = await this.findEntityOrThrow(companyId, id);
    return toCustomerResponse(customer);
  }

  async create(
    companyId: string,
    dto: CreateCustomerDto,
  ): Promise<CustomerResponse> {
    await this.assertUniqueDocument(companyId, dto.docType, dto.docNumber);

    const customer = this.customerRepository.create({
      companyId,
      docType: dto.docType,
      docNumber: dto.docNumber,
      legalName: dto.legalName,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      address: dto.address ?? null,
      ubigeo: dto.ubigeo ?? null,
      isActive: true,
    });

    const saved = await this.customerRepository.save(customer);
    return toCustomerResponse(saved);
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponse> {
    const customer = await this.findEntityOrThrow(companyId, id);

    const docType = dto.docType ?? customer.docType;
    const docNumber = dto.docNumber ?? customer.docNumber;

    if (docType !== customer.docType || docNumber !== customer.docNumber) {
      await this.assertUniqueDocument(companyId, docType, docNumber, id);
    }

    if (dto.docType !== undefined) customer.docType = dto.docType;
    if (dto.docNumber !== undefined) customer.docNumber = dto.docNumber;
    if (dto.legalName !== undefined) customer.legalName = dto.legalName;
    if (dto.email !== undefined) customer.email = dto.email;
    if (dto.phone !== undefined) customer.phone = dto.phone;
    if (dto.address !== undefined) customer.address = dto.address;
    if (dto.ubigeo !== undefined) customer.ubigeo = dto.ubigeo;
    if (dto.isActive !== undefined) customer.isActive = dto.isActive;

    const saved = await this.customerRepository.save(customer);
    return toCustomerResponse(saved);
  }

  private async findEntityOrThrow(
    companyId: string,
    id: string,
  ): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id, companyId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async assertUniqueDocument(
    companyId: string,
    docType: string,
    docNumber: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.customerRepository.findOne({
      where: { companyId, docType, docNumber },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        'A customer with this docType and docNumber already exists for this company',
      );
    }
  }
}
