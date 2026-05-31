import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyContact1710000000006 implements MigrationInterface {
  name = 'CompanyContact1710000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "email" varchar(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "phone" varchar(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
      DROP COLUMN IF EXISTS "phone"
    `);
    await queryRunner.query(`
      ALTER TABLE "companies"
      DROP COLUMN IF EXISTS "email"
    `);
  }
}
