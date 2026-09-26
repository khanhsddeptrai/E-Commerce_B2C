import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AuthServiceClient } from '@repo/proto';

@Injectable()
export class JwtAuthGuard implements CanActivate, OnModuleInit {
  private authServiceClient!: AuthServiceClient;

  constructor(@Inject('AUTH_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.authServiceClient = this.client.getService<AuthServiceClient>('AuthService');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // Ưu tiên đọc từ HttpOnly Cookie, dự phòng đọc từ Authorization header
    let token = request.cookies?.novatech_auth_token;
    if (!token) {
      const authHeader = request.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      throw new UnauthorizedException('Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn');
    }

    try {
      const res = await firstValueFrom(
        this.authServiceClient.validateToken({ access_token: token }),
      );

      if (!res.valid) {
        throw new UnauthorizedException(res.error || 'Token không hợp lệ hoặc đã hết hạn');
      }

      request.user = {
        userId: res.user_id,
        email: res.email,
        role: res.role,
      };

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Xác thực thất bại';
      throw new UnauthorizedException(message);
    }
  }
}
