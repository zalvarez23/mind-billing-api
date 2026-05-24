import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certificate } from '../companies/entities/certificate.entity';
import { CompanyCertificateService } from './company-certificate.service';
import { PfxBootstrapService } from './pfx-bootstrap.service';
import { XmlSignatureService } from './xml-signature.service';

@Module({
  imports: [TypeOrmModule.forFeature([Certificate])],
  providers: [
    PfxBootstrapService,
    CompanyCertificateService,
    XmlSignatureService,
  ],
  exports: [XmlSignatureService],
})
export class CryptoModule {}
