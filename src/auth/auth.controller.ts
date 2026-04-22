import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { JwtUser } from './jwt-user.type';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import {
  buildActionResponse,
  buildItemResponse,
} from '../common/api/api-response.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    const result = await this.authService.register(
      body.name,
      body.email,
      body.password,
      body.phone,
    );

    return buildActionResponse(
      {
        accessToken: result.accessToken,
        verificationExpiresAt: result.verificationExpiresAt,
        user: result.user,
      },
      result.message,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  @Post('login')
  async login(@Body() body: LoginDto) {
    const result = await this.authService.login(body.email, body.password);

    return buildActionResponse(
      {
        accessToken: result.accessToken,
        user: result.user,
      },
      result.message,
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  @Post('verify-email')
  async verifyEmail(@Body() body: VerifyEmailDto) {
    const result = await this.authService.verifyEmail(body.token);

    return buildActionResponse(
      {
        user: result.user,
      },
      result.message,
    );
  }

  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  @Post('resend-verification')
  async resendVerification(@Body() body: ResendVerificationDto) {
    const result = await this.authService.resendVerification(body.email);

    return buildActionResponse(
      {
        verificationExpiresAt: result.verificationExpiresAt,
      },
      result.message,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    const result = await this.authService.getProfile(user.userId);

    return buildItemResponse(result, 'Profil récupéré avec succès');
  }
}
