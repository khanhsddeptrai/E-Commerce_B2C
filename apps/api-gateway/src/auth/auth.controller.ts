import {
  Body,
  Controller,
  Get,
  Inject,
  OnModuleInit,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Response } from 'express';
import { AuthServiceClient } from '@repo/proto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

export interface RequestWithUser {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('api/v1/auth')
export class AuthController implements OnModuleInit {
  private authServiceClient!: AuthServiceClient;

  constructor(@Inject('AUTH_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.authServiceClient = this.client.getService<AuthServiceClient>('AuthService');
  }

  private setAuthCookie(res: Response, token: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('novatech_auth_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });
  }

  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 3,
    ttlSeconds: 300,
    keyPrefix: 'auth_register',
    message: 'Bạn đã đăng ký tài khoản quá nhiều lần. Vui lòng đợi 5 phút trước khi thử lại.',
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await firstValueFrom(this.authServiceClient.register(dto));
    if (result.access_token) {
      this.setAuthCookie(res, result.access_token);
    }
    return result;
  }

  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 5,
    ttlSeconds: 60,
    keyPrefix: 'auth_login',
    message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi 1 phút trước khi thử lại.',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await firstValueFrom(this.authServiceClient.login(dto));
    if (result.access_token) {
      this.setAuthCookie(res, result.access_token);
    }
    return result;
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('novatech_auth_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    return { success: true, message: 'Đăng xuất thành công' };
  }

  @Post('refresh')
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return firstValueFrom(
      this.authServiceClient.refreshToken({
        refresh_token: dto.refresh_token,
      }),
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: RequestWithUser) {
    return firstValueFrom(
      this.authServiceClient.getProfile({
        user_id: req.user.userId,
      }),
    );
  }
}
