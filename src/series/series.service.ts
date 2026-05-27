import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListSeriesQueryDto } from './dto/list-series-query.dto';
import { DocumentSeries } from './entities/document-series.entity';
import { SeriesListResponse } from './types/series-response.types';
import { toSeriesResponse } from './series.mapper';

@Injectable()
export class SeriesService {
  constructor(
    @InjectRepository(DocumentSeries)
    private readonly seriesRepository: Repository<DocumentSeries>,
  ) {}

  async findAll(
    companyId: string,
    query: ListSeriesQueryDto,
  ): Promise<SeriesListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.seriesRepository
      .createQueryBuilder('s')
      .where('s.companyId = :companyId', { companyId });

    if (query.docType) {
      qb.andWhere('s.docType = :docType', { docType: query.docType });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('s.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.q) {
      qb.andWhere('s.serie ILIKE :q', { q: `%${query.q}%` });
    }

    qb.orderBy('s.docType', 'ASC').addOrderBy('s.serie', 'ASC');

    const [series, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: series.map(toSeriesResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}

