import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentStatus } from '../../common/enums';
import { Company } from '../../companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { SunatSubmission } from './sunat-submission.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @Column({ name: 'doc_type', type: 'varchar', length: 2 })
  docType: string;

  @Column({ type: 'varchar', length: 4 })
  serie: string;

  @Column({ type: 'int' })
  correlativo: number;

  @Column({ type: 'varchar', length: 20, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ name: 'xml_content', type: 'text', nullable: true })
  xmlContent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => SunatSubmission, (submission) => submission.document)
  submissions: SunatSubmission[];
}
