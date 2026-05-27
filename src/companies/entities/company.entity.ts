import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SunatEnvironment } from '../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Certificate } from './certificate.entity';
import { DocumentSeries } from '../../series/entities/document-series.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Document } from '../../documents/entities/document.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 11, unique: true })
  ruc: string;

  @Column({ name: 'api_key', type: 'varchar', length: 64, unique: true })
  apiKey: string;

  @Column({ name: 'business_name', type: 'varchar', length: 255 })
  businessName: string;

  @Column({ name: 'trade_name', type: 'varchar', length: 255, nullable: true })
  tradeName: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 6, nullable: true })
  ubigeo: string | null;

  @Column({
    name: 'sunat_environment',
    type: 'varchar',
    length: 20,
    default: SunatEnvironment.BETA,
  })
  sunatEnvironment: SunatEnvironment;

  @Column({
    name: 'sol_username',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  solUsername: string | null;

  @Column({
    name: 'sol_password',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  solPassword: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => User, (user) => user.company)
  users: User[];

  @OneToMany(() => Certificate, (certificate) => certificate.company)
  certificates: Certificate[];

  @OneToMany(() => DocumentSeries, (series) => series.company)
  documentSeries: DocumentSeries[];

  @OneToMany(() => Customer, (customer) => customer.company)
  customers: Customer[];

  @OneToMany(() => Product, (product) => product.company)
  products: Product[];

  @OneToMany(() => Document, (document) => document.company)
  documents: Document[];
}
