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

class InvoiceClienteDto {
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

class InvoiceItemDto {
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

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  serie: string;

  @IsString()
  @IsNotEmpty()
  tipoOperacion: string;

  @IsString()
  @IsNotEmpty()
  moneda: string;

  @ValidateNested()
  @Type(() => InvoiceClienteDto)
  cliente: InvoiceClienteDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsOptional()
  @IsString()
  formaPago?: string;
}
