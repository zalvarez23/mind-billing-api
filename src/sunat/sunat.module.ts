import { Module } from '@nestjs/common';
import { BillServiceClient } from './bill-service.client';

@Module({
  providers: [BillServiceClient],
  exports: [BillServiceClient],
})
export class SunatModule {}
