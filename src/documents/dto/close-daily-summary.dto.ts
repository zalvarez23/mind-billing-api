import { IsDateString, IsOptional } from 'class-validator';

export class CloseDailySummaryDto {
  /** Fecha de emisión de las boletas incluidas (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  referenceDate?: string;

  /** Fecha de generación del resumen (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  issueDate?: string;
}
