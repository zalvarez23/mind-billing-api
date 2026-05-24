import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Company } from '../../companies/entities/company.entity';
import { REQUEST_COMPANY_KEY } from '../constants';

export const CurrentCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Company => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ [REQUEST_COMPANY_KEY]: Company }>();
    return request[REQUEST_COMPANY_KEY];
  },
);
