import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CompanyMatchGuard, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCompany } from '../common/decorators/current-company.decorator';
import { Company } from '../companies/entities/company.entity';
import { SeriesService } from './series.service';
import { ListSeriesQueryDto } from './dto/list-series-query.dto';
import { SeriesListResponse } from './types/series-response.types';

@Controller('series')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get()
  findAll(
    @CurrentCompany() company: Company,
    @Query() query: ListSeriesQueryDto,
  ): Promise<SeriesListResponse> {
    return this.seriesService.findAll(company.id, query);
  }
}
