import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, CookieOptions } from 'express';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly refreshTtlMilliseconds: number;
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const domain = configService.get<string>('COOKIE_DOMAIN');
    this.cookieName = configService.getOrThrow<string>('COOKIE_NAME');
    this.refreshTtlMilliseconds =
      configService.getOrThrow<number>('JWT_REFRESH_TTL_SECONDS') * 1000;
    this.cookieOptions = {
      httpOnly: true,
      secure: configService.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: 'lax',
      path: '/api/auth',
      ...(domain ? { domain } : {}),
    };
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(response, result.refreshToken);
    return this.toResponse(result);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(response, result.refreshToken);
    return this.toResponse(result);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.getRefreshToken(request);
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const result = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(response, result.refreshToken);
    return this.toResponse(result);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.getRefreshToken(request));
    response.clearCookie(this.cookieName, this.cookieOptions);
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(this.cookieName, refreshToken, {
      ...this.cookieOptions,
      maxAge: this.refreshTtlMilliseconds,
    });
  }

  private getRefreshToken(request: Request): string | undefined {
    const cookies: unknown = request.cookies;
    if (!cookies || typeof cookies !== 'object') {
      return undefined;
    }

    const parsedCookies = cookies as Record<string, unknown>;
    const refreshToken = parsedCookies[this.cookieName];
    return typeof refreshToken === 'string' ? refreshToken : undefined;
  }

  private toResponse<T extends { accessToken: string; user: unknown }>(
    result: T,
  ) {
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }
}
