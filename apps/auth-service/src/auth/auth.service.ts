import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const email = data.email?.toLowerCase()?.trim();
    if (!email) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Email không được để trống',
      });
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: 'Email đã được sử dụng',
      });
    }

    const fullName = data.full_name || (data as any).fullName;
    if (!fullName) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Họ tên không được để trống',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone: data.phone || null,
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        phone: user.phone || undefined,
        avatar_url: user.avatarUrl || undefined,
        role: user.role,
        status: user.status,
        created_at: user.createdAt.toISOString(),
      },
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: 900, // 15 phút
    };
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const email = data.email?.toLowerCase()?.trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Email hoặc mật khẩu không chính xác',
      });
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Email hoặc mật khẩu không chính xác',
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'Tài khoản đã bị tạm khóa hoặc chưa kích hoạt',
      });
    }

    const deviceInfo = data.device_info || (data as any).deviceInfo;
    const tokens = await this.generateTokens(user.id, user.email, user.role, deviceInfo);

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        phone: user.phone || undefined,
        avatar_url: user.avatarUrl || undefined,
        role: user.role,
        status: user.status,
        created_at: user.createdAt.toISOString(),
      },
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: 900,
    };
  }

  async refreshToken(data: RefreshTokenRequest): Promise<TokenResponse> {
    const rawToken = data.refresh_token || (data as any).refreshToken;
    if (!rawToken) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Refresh token không được để trống',
      });
    }

    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Refresh Token không hợp lệ hoặc đã hết hạn',
      });
    }

    // Revoke previous refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens (Token rotation)
    const newTokens = await this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
      storedToken.deviceInfo || undefined,
    );

    return {
      access_token: newTokens.accessToken,
      refresh_token: newTokens.refreshToken,
      expires_in: 900,
    };
  }

  async validateToken(data: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    try {
      const token = data.access_token || (data as any).accessToken;
      const payload = this.jwtService.verify(token);
      return {
        valid: true,
        user_id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch (err: any) {
      return {
        valid: false,
        user_id: '',
        email: '',
        role: '',
        error: err.message || 'Token không hợp lệ',
      };
    }
  }

  async getProfile(data: GetProfileRequest): Promise<UserProfileResponse> {
    const userId = data.user_id || (data as any).userId;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Người dùng không tồn tại',
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        phone: user.phone || undefined,
        avatar_url: user.avatarUrl || undefined,
        role: user.role,
        status: user.status,
        created_at: user.createdAt.toISOString(),
      },
    };
  }

  private async generateTokens(userId: string, email: string, role: string, deviceInfo?: string) {
    const payload = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceInfo: deviceInfo || null,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
