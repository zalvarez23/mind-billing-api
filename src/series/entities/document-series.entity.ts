import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { SunatDocumentType } from '../../catalog/entities/sunat-document-type.entity';

@Entity('document_series')
@Unique(['companyId', 'docType', 'serie'])
export class DocumentSeries {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.documentSeries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'doc_type', type: 'varchar', length: 2 })
  docType: string;

  @ManyToOne(() => SunatDocumentType, (type) => type.documentSeries)
  @JoinColumn({ name: 'doc_type' })
  documentType: SunatDocumentType;

  @Column({ type: 'varchar', length: 4 })
  serie: string;

  @Column({ type: 'int', default: 0 })
  correlativo: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
