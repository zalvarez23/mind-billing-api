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
  DocumentsController,
  InvoicesController,
} from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { SunatSubmission } from './entities/sunat-submission.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Document,
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
  controllers: [InvoicesController, DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
