import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { DocumentSeries } from '../../series/entities/document-series.entity';

@Entity('sunat_document_types')
export class SunatDocumentType {
  @PrimaryColumn({ type: 'varchar', length: 2 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => DocumentSeries, (series) => series.documentType)
  documentSeries: DocumentSeries[];
}
