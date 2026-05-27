import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DocumentSeries } from './entities/document-series.entity';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([DocumentSeries])],
  controllers: [SeriesController],
  providers: [SeriesService],
})
export class SeriesModule {}

