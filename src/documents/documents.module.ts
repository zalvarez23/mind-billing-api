import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoModule } from '../crypto/crypto.module';
import { AuthModule } from '../auth/auth.module';
import { Company } from '../companies/entities/company.entity';
import { DocumentSeries } from '../series/entities/document-series.entity';
import { User } from '../users/entities/user.entity';
import { SunatModule } from '../sunat/sunat.module';
import { StorageModule } from '../storage/storage.module';
import { UblModule } from '../ubl/ubl.module';
import {
  BoletasController,
  CreditNotesController,
  DailySummariesController,
  DebitNotesController,
  DocumentsController,
  InvoicesController,
  VoidedDocumentsController,
} from './documents.controller';
import { DailySummariesService } from './daily-summaries.service';
import { DailySummariesXmlHelper } from './daily-summaries-xml.helper';
import { DocumentsService } from './documents.service';
import { VoidedDocumentsService } from './voided-documents.service';
import { DailySummary } from './entities/daily-summary.entity';
import { Document } from './entities/document.entity';
import { SunatSubmission } from './entities/sunat-submission.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Document,
      DailySummary,
      SunatSubmission,
      DocumentSeries,
      Company,
      User,
    ]),
    UblModule,
    SunatModule,
    StorageModule,
    CryptoModule,
  ],
  controllers: [
    InvoicesController,
    BoletasController,
    CreditNotesController,
    DebitNotesController,
    VoidedDocumentsController,
    DailySummariesController,
    DocumentsController,
  ],
  providers: [
    DocumentsService,
    DailySummariesXmlHelper,
    DailySummariesService,
    VoidedDocumentsService,
  ],
})
export class DocumentsModule {}
