import { MigrationInterface, QueryRunner } from 'typeorm';

export class CertificatePfxContent1710000000005 implements MigrationInterface {
  name = 'CertificatePfxContent1710000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "certificates"
      ADD COLUMN IF NOT EXISTS "pfx_content" BYTEA
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "certificates"
      DROP COLUMN IF EXISTS "pfx_content"
    `);
  }
}
