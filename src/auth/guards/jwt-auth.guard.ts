import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { REQUEST_COMPANY_KEY, REQUEST_USER_KEY } from '../../common/constants';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

type AuthenticatedRequest = Request & {
  user?: JwtPayload;
  [REQUEST_COMPANY_KEY]?: Company;
  [REQUEST_USER_KEY]?: User;
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class CompanyMatchGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const company = request[REQUEST_COMPANY_KEY];
    const jwtUser = request.user;

    if (!company) {
      throw new UnauthorizedException('Company context not resolved');
    }

    if (!jwtUser) {
      throw new UnauthorizedException('JWT context not resolved');
    }

    if (jwtUser.companyId !== company.id) {
      throw new ForbiddenException(
        'User does not belong to the company of this API key',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: jwtUser.sub, isActive: true },
    });

    if (!user) {
      throw new ForbiddenException('User is inactive or not found');
    }

    request[REQUEST_USER_KEY] = user;

    return true;
  }
}
