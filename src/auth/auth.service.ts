import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { toCompanyResponse } from '../companies/company.mapper';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const company = await this.companyRepository.findOne({
      where: {
        ruc: loginDto.ruc,
        isActive: true,
      },
    });

    if (!company) {
      throw new UnauthorizedException('Invalid company');
    }

    const user = await this.userRepository.findOne({
      where: {
        username: loginDto.username,
        companyId: company.id,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.companyId !== company.id) {
      throw new ForbiddenException(
        'User does not belong to the company of this API key',
      );
    }

    const payload: JwtPayload = {
      sub: user.id,
      companyId: company.id,
      username: user.username,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
      },
      company: toCompanyResponse(company),
    };
  }

  getProfile(user: User, company: Company) {
    return {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
      },
      company: toCompanyResponse(company),
    };
  }
}
