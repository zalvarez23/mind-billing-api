import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompanyMatchGuard, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCompany } from '../common/decorators/current-company.decorator';
import { Company } from '../companies/entities/company.entity';
import { CertificatesService } from './certificates.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { ListCertificatesQueryDto } from './dto/list-certificates-query.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import {
  CertificateListResponse,
  CertificateResponse,
} from './types/certificate-response.types';

const MAX_PFX_BYTES = 2 * 1024 * 1024;

type UploadedPfxFile = {
  buffer: Buffer;
  originalname: string;
};

@Controller('certificates')
@UseGuards(JwtAuthGuard, CompanyMatchGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get()
  findAll(
    @CurrentCompany() company: Company,
    @Query() query: ListCertificatesQueryDto,
  ): Promise<CertificateListResponse> {
    return this.certificatesService.findAll(company.id, query);
  }

  @Get(':id')
  findOne(
    @CurrentCompany() company: Company,
    @Param('id') id: string,
  ): Promise<CertificateResponse> {
    return this.certificatesService.findById(company.id, id);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PFX_BYTES },
    }),
  )
  create(
    @CurrentCompany() company: Company,
    @UploadedFile() file: UploadedPfxFile | undefined,
    @Body() dto: CreateCertificateDto,
  ): Promise<CertificateResponse> {
    const buffer = this.readUploadedPfx(file);
    return this.certificatesService.create(company.id, buffer, dto);
  }

  @Patch(':id')
  update(
    @CurrentCompany() company: Company,
    @Param('id') id: string,
    @Body() dto: UpdateCertificateDto,
  ): Promise<CertificateResponse> {
    return this.certificatesService.update(company.id, id, dto);
  }

  private readUploadedPfx(file: UploadedPfxFile | undefined): Buffer {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Multipart field "file" is required (.pfx or .p12)',
      );
    }

    const name = file.originalname.toLowerCase();
    if (!name.endsWith('.pfx') && !name.endsWith('.p12')) {
      throw new BadRequestException('File must have extension .pfx or .p12');
    }

    return file.buffer;
  }
}
