import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { SunatEnvironment } from '../../common/enums';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tradeName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

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
  @Matches(/^\d{6}$/)
  ubigeo?: string | null;

  @IsOptional()
  @IsEnum(SunatEnvironment)
  sunatEnvironment?: SunatEnvironment;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  solUsername?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  solPassword?: string | null;
}
