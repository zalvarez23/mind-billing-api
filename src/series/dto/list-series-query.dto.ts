import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const SUNAT_DOC_TYPES = ['01', '03', '07', '08'] as const;

export class ListSeriesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(4)
  q?: string;

  @IsOptional()
  @IsIn(SUNAT_DOC_TYPES)
  docType?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

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
