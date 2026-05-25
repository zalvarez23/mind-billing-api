import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class BoletaClienteDto {
  @IsString()
  @IsNotEmpty()
  tipoDoc: string;

  @IsString()
  @IsNotEmpty()
  numDoc: string;

  @IsString()
  @IsNotEmpty()
  razonSocial: string;
}

class BoletaItemDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  igv?: number;
}

export class CreateBoletaDto {
  @IsString()
  @IsNotEmpty()
  serie: string;

  @IsString()
  @IsNotEmpty()
  moneda: string;

  @ValidateNested()
  @Type(() => BoletaClienteDto)
  cliente: BoletaClienteDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BoletaItemDto)
  items: BoletaItemDto[];

  @IsOptional()
  @IsString()
  tipoOperacion?: string;

  @IsOptional()
  @IsString()
  formaPago?: string;
}
