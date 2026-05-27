import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { DocumentStatus } from '../../common/enums';

const SUNAT_DOC_TYPES = ['01', '03', '07', '08'] as const;

export class ListDocumentsQueryDto {
  /** Fecha exacta de emisión (YYYY-MM-DD). Tiene prioridad sobre from/to. */
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  /** Inicio de rango de emisión (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Fin de rango de emisión (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(SUNAT_DOC_TYPES)
  docType?: string;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsString()
  serie?: string;

  /** Boletas/notas firmadas sin RC (signed + sin daily_summary_id + tipos 03/07/08). */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  pendingRc?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
