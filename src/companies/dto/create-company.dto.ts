import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SunatEnvironment } from '../../common/enums';
import { CreateCompanyInitialUserDto } from './create-company-initial-user.dto';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, { message: 'ruc must be 11 digits' })
  ruc: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  businessName: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  ubigeo?: string;

  @IsOptional()
  @IsEnum(SunatEnvironment)
  sunatEnvironment?: SunatEnvironment;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  solUsername?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  solPassword?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCompanyInitialUserDto)
  initialUser?: CreateCompanyInitialUserDto;
}
