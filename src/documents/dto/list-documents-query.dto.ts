import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DocumentStatus } from '../../common/enums';
import { toQueryStringArray } from '../../common/query-param.util';

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

  /** Uno o varios tipos: `03` o `03,07,08` (también `docType=03&docType=07`). */
  @IsOptional()
  @Transform(({ value }) => toQueryStringArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(SUNAT_DOC_TYPES, { each: true })
  docType?: string[];

  /** Uno o varios estados: `accepted` o `accepted,signed`. */
  @IsOptional()
  @Transform(({ value }) => toQueryStringArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(DocumentStatus, { each: true })
  status?: DocumentStatus[];

  @IsOptional()
  @IsString()
  serie?: string;

  /** Boletas/notas firmadas sin RC (signed + sin daily_summary_id + tipos 03/07/08). */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  pendingRc?: boolean;

  /** Búsqueda en serie, correlativo, serie-correlativo, cliente (numDoc, razonSocial) e id. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

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
