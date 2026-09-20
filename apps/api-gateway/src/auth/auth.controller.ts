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

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    try {
      return await firstValueFrom(this.authServiceClient.register(dto));
    } catch (err: unknown) {
      throw err;
    }
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    try {
      return await firstValueFrom(this.authServiceClient.login(dto));
    } catch (err: unknown) {
      throw err;
    }
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
