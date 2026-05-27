import { SunatDocumentType } from '../../catalog/entities/sunat-document-type.entity';
import { Company } from '../../companies/entities/company.entity';
import { Certificate } from '../../companies/entities/certificate.entity';
import { User } from '../../users/entities/user.entity';
import { DocumentSeries } from '../../series/entities/document-series.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Product } from '../../products/entities/product.entity';
import { Document } from '../../documents/entities/document.entity';
import { DailySummary } from '../../documents/entities/daily-summary.entity';
import { SunatSubmission } from '../../documents/entities/sunat-submission.entity';

export const entities = [
  SunatDocumentType,
  Company,
  User,
  Certificate,
  DocumentSeries,
  Customer,
  Product,
  Document,
  DailySummary,
  SunatSubmission,
];
