import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class NoteClienteDto {
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

class NoteItemDto {
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

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  serie: string;

  @IsString()
  @IsNotEmpty()
  moneda: string;

  @IsUUID()
  documentoAfectadoId: string;

  @ValidateNested()
  @Type(() => NoteClienteDto)
  cliente: NoteClienteDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NoteItemDto)
  items: NoteItemDto[];

  @IsOptional()
  @IsString()
  motivoCodigo?: string;

  @IsOptional()
  @IsString()
  motivoDescripcion?: string;
}
