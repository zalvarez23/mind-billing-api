import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { REQUEST_USER_KEY } from '../constants';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ [REQUEST_USER_KEY]: User }>();
    return request[REQUEST_USER_KEY];
  },
);
