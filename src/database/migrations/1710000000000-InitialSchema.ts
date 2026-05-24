import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "sunat_document_types" (
        "code" varchar(2) NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_sunat_document_types" PRIMARY KEY ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ruc" varchar(11) NOT NULL,
        "api_key" varchar(64) NOT NULL,
        "business_name" varchar(255) NOT NULL,
        "trade_name" varchar(255),
        "address" varchar(500),
        "ubigeo" varchar(6),
        "sunat_environment" varchar(20) NOT NULL DEFAULT 'beta',
        "sol_username" varchar(100),
        "sol_password" varchar(100),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_companies" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_companies_ruc" UNIQUE ("ruc"),
        CONSTRAINT "UQ_companies_api_key" UNIQUE ("api_key"),
        CONSTRAINT "CHK_companies_sunat_environment" CHECK (
          "sunat_environment" IN ('beta', 'homologacion', 'production')
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_companies_api_key_active"
      ON "companies" ("api_key")
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "username" varchar(100) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "full_name" varchar(255),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_company_username" UNIQUE ("company_id", "username"),
        CONSTRAINT "FK_users_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_company_id" ON "users" ("company_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "document_series" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "doc_type" varchar(2) NOT NULL,
        "serie" varchar(4) NOT NULL,
        "correlativo" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_series" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_series" UNIQUE ("company_id", "doc_type", "serie"),
        CONSTRAINT "FK_document_series_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_document_series_doc_type" FOREIGN KEY ("doc_type")
          REFERENCES "sunat_document_types"("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "doc_type" varchar(1) NOT NULL DEFAULT '6',
        "doc_number" varchar(15) NOT NULL,
        "legal_name" varchar(255) NOT NULL,
        "email" varchar(255),
        "phone" varchar(50),
        "address" varchar(500),
        "ubigeo" varchar(6),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_customers" UNIQUE ("company_id", "doc_type", "doc_number"),
        CONSTRAINT "FK_customers_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_customers_company_id" ON "customers" ("company_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "certificates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "alias" varchar(100),
        "pfx_path" varchar(500),
        "pfx_password" varchar(255),
        "valid_from" date,
        "valid_to" date,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_certificates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_certificates_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "created_by" uuid,
        "doc_type" varchar(2) NOT NULL,
        "serie" varchar(4) NOT NULL,
        "correlativo" integer NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "total" decimal(12,2) NOT NULL DEFAULT 0,
        "payload" jsonb,
        "xml_content" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_documents_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_documents_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sunat_submissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL,
        "method" varchar(50) NOT NULL,
        "ticket" varchar(100),
        "status_code" varchar(10),
        "cdr_xml" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sunat_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sunat_submissions_document" FOREIGN KEY ("document_id")
          REFERENCES "documents"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sunat_submissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "certificates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_series"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "companies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sunat_document_types"`);
  }
}
