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
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Không tìm thấy Bearer Token');
    }

    const token = authHeader.split(' ')[1];

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
    } catch (err: any) {
      throw new UnauthorizedException(err.message || 'Xác thực thất bại');
    }
  }
}
