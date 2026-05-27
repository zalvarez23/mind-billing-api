import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @Length(1, 1)
  docType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  docNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  legalName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  ubigeo?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
