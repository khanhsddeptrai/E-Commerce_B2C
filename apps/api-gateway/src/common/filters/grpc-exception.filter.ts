import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GrpcToHttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Nếu đã là HttpException (như ValidationPipe 400 hoặc JwtAuthGuard 401)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      return response.status(status).json(typeof res === 'string' ? { statusCode: status, message: res } : res);
    }

    // Xử lý lỗi gRPC status code
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = exception.details || exception.message || 'Lỗi hệ thống nội bộ';

    // Mã lỗi gRPC chuẩn
    switch (exception.code) {
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
