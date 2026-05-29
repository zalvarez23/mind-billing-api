import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateCertificateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  alias?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  pfxPassword?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
