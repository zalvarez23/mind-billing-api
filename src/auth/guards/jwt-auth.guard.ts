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
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const jwtUser = request.user;

    if (!jwtUser) {
      throw new UnauthorizedException('JWT context not resolved');
    }

    const company = await this.companyRepository.findOne({
      where: { id: jwtUser.companyId, isActive: true },
    });

    if (!company) {
      throw new ForbiddenException('Company is inactive or not found');
    }

    const user = await this.userRepository.findOne({
      where: { id: jwtUser.sub, companyId: jwtUser.companyId, isActive: true },
    });

    if (!user) {
      throw new ForbiddenException(
        'User is inactive, not found, or mismatched',
      );
    }

    request[REQUEST_COMPANY_KEY] = company;
    request[REQUEST_USER_KEY] = user;

    return true;
  }
}
