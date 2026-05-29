import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminApiKeyGuard } from '../auth/guards/admin-api-key.guard';
import { DocumentSeries } from '../series/entities/document-series.entity';
import { User } from '../users/entities/user.entity';
import { AdminCompaniesController } from './admin-companies.controller';
import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Company, DocumentSeries, User]),
  ],
  controllers: [AdminCompaniesController],
  providers: [CompaniesService, AdminApiKeyGuard],
  exports: [CompaniesService, TypeOrmModule],
})
export class CompaniesModule {}
