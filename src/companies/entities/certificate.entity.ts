import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from './company.entity';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.certificates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ type: 'varchar', length: 100, nullable: true })
  alias: string | null;

  @Column({ name: 'pfx_path', type: 'varchar', length: 500, nullable: true })
  pfxPath: string | null;

  /** Contenido del .pfx (recomendado en Render; el disco del contenedor es efímero). */
  @Column({ name: 'pfx_content', type: 'bytea', nullable: true })
  pfxContent: Buffer | null;

  @Column({
    name: 'pfx_password',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  pfxPassword: string | null;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: string | null;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
