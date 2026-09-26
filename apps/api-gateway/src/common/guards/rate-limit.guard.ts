import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const clientIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      '127.0.0.1';

    const cleanIp = clientIp.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const prefix = options.keyPrefix || 'default';
    const redisKey = `ratelimit:${prefix}:${cleanIp}`;

    try {
      const redis = this.redisService.getClient();
      if (!redis) {
        return true;
      }

      const current = await redis.incr(redisKey);
      if (current === 1) {
        await redis.expire(redisKey, options.ttlSeconds);
      }

      const ttlRemaining = await redis.ttl(redisKey);

      response.setHeader('X-RateLimit-Limit', options.limit);
      response.setHeader('X-RateLimit-Remaining', Math.max(0, options.limit - current));
      response.setHeader('X-RateLimit-Reset', ttlRemaining > 0 ? ttlRemaining : options.ttlSeconds);

      if (current > options.limit) {
        const waitTime = ttlRemaining > 0 ? ttlRemaining : options.ttlSeconds;
        const msg =
          options.message ||
          `Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ${waitTime} giây.`;

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message: msg,
            retryAfter: waitTime,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis rate limit error, allowing request: ${msg}`);
      return true;
    }
  }
}
