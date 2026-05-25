import { MigrationInterface, QueryRunner } from 'typeorm';

export class Sprint3NotesRa1710000000003 implements MigrationInterface {
  name = 'Sprint3NotesRa1710000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "daily_summaries"
      ADD COLUMN "summary_type" varchar(2) NOT NULL DEFAULT 'RC'
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_daily_summaries_company_type_issue"
      ON "daily_summaries" ("company_id", "summary_type", "issue_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_daily_summaries_company_type_issue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_summaries" DROP COLUMN IF EXISTS "summary_type"`,
    );
  }
}
