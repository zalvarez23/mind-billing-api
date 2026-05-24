import { MigrationInterface, QueryRunner } from 'typeorm';

export class Sprint2Closure1710000000001 implements MigrationInterface {
  name = 'Sprint2Closure1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sunat_submissions"
      ADD COLUMN IF NOT EXISTS "error_message" text
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_documents_company_doc_serie_correlativo"
      ON "documents" ("company_id", "doc_type", "serie", "correlativo")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_documents_company_doc_serie_correlativo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sunat_submissions" DROP COLUMN IF EXISTS "error_message"`,
    );
  }
}
