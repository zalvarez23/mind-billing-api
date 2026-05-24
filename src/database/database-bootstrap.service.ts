import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { runSeed } from './seeds/run-seed';

@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const seedOnStart = this.configService.get<boolean>('database.seedOnStart');

    if (!seedOnStart) {
      this.logger.log('DB seed on start disabled (DB_SEED_ON_START=false)');
      return;
    }

    this.logger.log('Running idempotent database seed...');
    await runSeed(this.dataSource);
    this.logger.log('Database seed completed');
  }
}
