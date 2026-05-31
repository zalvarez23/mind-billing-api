import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminApiKeyGuard } from '../auth/guards/admin-api-key.guard';
import { DocumentSeries } from '../series/entities/document-series.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AdminCompaniesController } from './admin-companies.controller';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    TypeOrmModule.forFeature([Company, DocumentSeries, User]),
  ],
  controllers: [AdminCompaniesController, CompaniesController],
  providers: [CompaniesService, AdminApiKeyGuard],
  exports: [CompaniesService, TypeOrmModule],
})
export class CompaniesModule {}
