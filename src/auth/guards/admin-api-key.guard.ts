import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ADMIN_API_KEY_HEADER } from '../../common/constants';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('ADMIN_API_KEY');

    if (!expected?.trim()) {
      throw new UnauthorizedException('ADMIN_API_KEY is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[ADMIN_API_KEY_HEADER];

    if (!provided || typeof provided !== 'string') {
      throw new UnauthorizedException('Missing X-Admin-Api-Key header');
    }

    if (provided !== expected) {
      throw new UnauthorizedException('Invalid admin API key');
    }

    return true;
  }
}
