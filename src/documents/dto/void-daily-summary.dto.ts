import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class VoidDailySummaryDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  documentIds: string[];

  /** Fecha de emisión original de las boletas (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  referenceDate?: string;

  /** Fecha de generación del RC de anulación (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  issueDate?: string;
}
