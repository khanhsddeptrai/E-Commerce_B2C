import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import {
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  ValidateTokenRequest,
  GetProfileRequest,
  AuthResponse,
  TokenResponse,
  ValidateTokenResponse,
  UserProfileResponse,
} from '@repo/proto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('AuthService', 'Register')
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      console.log('>>> [AuthService.Register] received request for:', data.email);
      const res = await this.authService.register(data);
      console.log('>>> [AuthService.Register] user registered successfully:', res.user.id);
      return res;
    } catch (err: unknown) {
      console.error('>>> [AuthService.Register] error:', err);
      throw err;
    }
  }

  @GrpcMethod('AuthService', 'Login')
  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.authService.login(data);
  }

  @GrpcMethod('AuthService', 'RefreshToken')
  async refreshToken(data: RefreshTokenRequest): Promise<TokenResponse> {
    return this.authService.refreshToken(data);
  }

  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(data: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    return this.authService.validateToken(data);
  }

  @GrpcMethod('AuthService', 'GetProfile')
  async getProfile(data: GetProfileRequest): Promise<UserProfileResponse> {
    return this.authService.getProfile(data);
  }
}
