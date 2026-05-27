import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CancelDocumentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  documentIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelReason?: string;
}
