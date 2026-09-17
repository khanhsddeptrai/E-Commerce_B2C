import {
  Body,
  Controller,
  Get,
  Inject,
  OnModuleInit,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AuthServiceClient } from '@repo/proto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController implements OnModuleInit {
  private authServiceClient!: AuthServiceClient;

  constructor(@Inject('AUTH_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.authServiceClient = this.client.getService<AuthServiceClient>('AuthService');
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    try {
      return await firstValueFrom(
        this.authServiceClient.register({
          email: dto.email,
          password: dto.password,
          full_name: dto.full_name,
          phone: dto.phone,
        }),
      );
    } catch (err: any) {
      console.error('>>> [API Gateway /register] Error:', err);
      throw err;
    }
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return firstValueFrom(
      this.authServiceClient.login({
        email: dto.email,
        password: dto.password,
        device_info: dto.device_info,
      }),
    );
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
  async getMe(@Req() req: any) {
    return firstValueFrom(
      this.authServiceClient.getProfile({
        user_id: req.user.userId,
      }),
    );
  }
}
