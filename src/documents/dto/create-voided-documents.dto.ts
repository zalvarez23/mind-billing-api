import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateVoidedDocumentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  documentIds: string[];

  /** Fecha de emisión de los comprobantes a dar de baja. */
  @IsOptional()
  @IsDateString()
  referenceDate?: string;

  /** Fecha de generación de la comunicación. */
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  motivoBaja?: string;
}
