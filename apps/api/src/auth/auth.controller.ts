import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { LoginResponse } from '@hubday/contracts';
import { Public } from '../common/public.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './auth.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange seeded credentials for a 12h bearer token' })
  login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.auth.login(body);
  }
}
