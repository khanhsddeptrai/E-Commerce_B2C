import { ArgumentsHost, Catch, Logger, RpcExceptionFilter } from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { Observable, throwError } from 'rxjs';

interface GrpcErrorPayload {
  code: number;
  message: string;
}

/** Nhận diện RpcException theo hình dạng (có getError() trả về { code, message }) thay vì instanceof */
function rpcPayloadOf(exception: unknown): GrpcErrorPayload | null {
  if (typeof exception !== 'object' || exception === null || !('getError' in exception)) return null;
  const getError = (exception as { getError: unknown }).getError;
  if (typeof getError !== 'function') return null;
  const payload: unknown = getError.call(exception);
  if (typeof payload === 'object' && payload !== null && 'code' in payload && typeof payload.code === 'number') {
    const message = 'message' in payload && typeof payload.message === 'string' ? payload.message : '';
    return { code: payload.code, message };
  }
  return null;
}

/**
 * Bộ lọc lỗi gRPC toàn cục cho Order Service.
 *
 * Bộ lọc mặc định của NestJS kiểm tra `exception instanceof RpcException`. Trong monorepo pnpm, order-service
 * đang nạp một bản cài @nestjs/microservices khác với bản mà @nestjs/core dùng (khác peer dependency ioredis),
 * nên phép instanceof luôn sai và mọi lỗi nghiệp vụ (hết hàng, không tìm thấy đơn…) bị trả thành
 * "Internal server error" (gRPC UNKNOWN). Bộ lọc này giữ đúng mã gRPC và thông báo gốc.
 */
@Catch()
export class GrpcExceptionFilter implements RpcExceptionFilter {
  private readonly logger = new Logger(GrpcExceptionFilter.name);

  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    const payload = rpcPayloadOf(exception);
    if (payload) {
      return throwError(() => payload);
    }

    const message = exception instanceof Error ? exception.message : String(exception);
    this.logger.error(`Lỗi không mong đợi: ${message}`, exception instanceof Error ? exception.stack : undefined);
    return throwError(() => ({ code: status.INTERNAL, message: 'Lỗi hệ thống nội bộ' }));
  }
}
