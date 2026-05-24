import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiKeyGuard } from './guards/api-key.guard';
import { CompanyMatchGuard, JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentCompany } from '../common/decorators/current-company.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Company } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ApiKeyGuard)
  login(@CurrentCompany() company: Company, @Body() loginDto: LoginDto) {
    return this.authService.login(company, loginDto);
  }

  @Get('me')
  @UseGuards(ApiKeyGuard, JwtAuthGuard, CompanyMatchGuard)
  me(@CurrentCompany() company: Company, @CurrentUser() user: User) {
    return this.authService.getProfile(user, company);
  }
}
