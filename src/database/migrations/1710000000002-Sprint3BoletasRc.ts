import { MigrationInterface, QueryRunner } from 'typeorm';

export class Sprint3BoletasRc1710000000002 implements MigrationInterface {
  name = 'Sprint3BoletasRc1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "daily_summaries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "created_by" uuid,
        "summary_code" varchar(30) NOT NULL,
        "reference_date" date NOT NULL,
        "issue_date" date NOT NULL,
        "correlativo" integer NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "ticket" varchar(100),
        "status_code" varchar(10),
        "cdr_xml" text,
        "error_message" text,
        "xml_content" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_daily_summaries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_daily_summaries_code" UNIQUE ("company_id", "summary_code"),
        CONSTRAINT "FK_daily_summaries_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_daily_summaries_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_daily_summaries_company_reference"
      ON "daily_summaries" ("company_id", "reference_date")
    `);

    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD COLUMN "issue_date" date,
      ADD COLUMN "daily_summary_id" uuid,
      ADD CONSTRAINT "FK_documents_daily_summary" FOREIGN KEY ("daily_summary_id")
        REFERENCES "daily_summaries"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_documents_pending_rc"
      ON "documents" ("company_id", "doc_type", "status", "issue_date")
      WHERE "doc_type" = '03' AND "daily_summary_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "FK_documents_daily_summary"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN IF EXISTS "daily_summary_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN IF EXISTS "issue_date"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_summaries"`);
  }
}
