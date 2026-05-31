import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  DailySummaryStatus,
  DailySummaryType,
} from '../entities/daily-summary.entity';

export class ListDailySummariesQueryDto {
  /** Fecha de emisión de los comprobantes del RC (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  referenceDate?: string;

  /** Fecha exacta de envío del resumen a SUNAT (YYYY-MM-DD). Prioridad sobre from/to. */
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  /** Inicio de rango de envío (issue_date). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Fin de rango de envío (issue_date). */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(DailySummaryType)
  summaryType?: DailySummaryType;

  @IsOptional()
  @IsEnum(DailySummaryStatus)
  status?: DailySummaryStatus;

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
