import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

interface GrpcError {
  code?: number;
  details?: string;
  message?: string;
}

@Catch()
export class GrpcToHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Nếu đã là HttpException (như ValidationPipe 400 hoặc JwtAuthGuard 401)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      return response.status(status).json(typeof res === 'string' ? { statusCode: status, message: res } : res);
    }

    // Xử lý lỗi gRPC status code
    const grpcErr = (exception || {}) as GrpcError;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = grpcErr.details || grpcErr.message || 'Lỗi hệ thống nội bộ';

    // Mã lỗi gRPC chuẩn
    switch (grpcErr.code) {
      case 3: // INVALID_ARGUMENT
        status = HttpStatus.BAD_REQUEST;
        break;
      case 5: // NOT_FOUND
        status = HttpStatus.NOT_FOUND;
        break;
      case 6: // ALREADY_EXISTS
        status = HttpStatus.CONFLICT;
        break;
      case 7: // PERMISSION_DENIED
        status = HttpStatus.FORBIDDEN;
        break;
      case 16: // UNAUTHENTICATED
        status = HttpStatus.UNAUTHORIZED;
        break;
      case 8: // RESOURCE_EXHAUSTED (vd hết hàng)
      case 9: // FAILED_PRECONDITION (vd sai trạng thái đơn)
      case 10: // ABORTED (vd đơn vừa bị thao tác khác cập nhật)
        status = HttpStatus.CONFLICT;
        break;
      case 4: // DEADLINE_EXCEEDED
        status = HttpStatus.GATEWAY_TIMEOUT;
        break;
      case 14: // UNAVAILABLE (service phía sau không phản hồi)
        status = HttpStatus.SERVICE_UNAVAILABLE;
        break;
      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        break;
    }

    return response.status(status).json({
      statusCode: status,
      message,
    });
  }
}
