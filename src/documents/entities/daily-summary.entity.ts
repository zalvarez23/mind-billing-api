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
import { Company } from '../../companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { Document } from './document.entity';

export enum DailySummaryType {
  RC = 'RC',
  RA = 'RA',
}

export enum DailySummaryStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PROCESSING = 'processing',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('daily_summaries')
export class DailySummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @Column({
    name: 'summary_type',
    type: 'varchar',
    length: 2,
    default: DailySummaryType.RC,
  })
  summaryType: DailySummaryType;

  @Column({ name: 'summary_code', type: 'varchar', length: 30 })
  summaryCode: string;

  @Column({ name: 'reference_date', type: 'date' })
  referenceDate: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ type: 'int' })
  correlativo: number;

  @Column({ type: 'varchar', length: 20, default: DailySummaryStatus.DRAFT })
  status: DailySummaryStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ticket: string | null;

  @Column({ name: 'status_code', type: 'varchar', length: 10, nullable: true })
  statusCode: string | null;

  @Column({ name: 'cdr_xml', type: 'text', nullable: true })
  cdrXml: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'xml_content', type: 'text', nullable: true })
  xmlContent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Document, (document) => document.dailySummary)
  documents: Document[];
}
