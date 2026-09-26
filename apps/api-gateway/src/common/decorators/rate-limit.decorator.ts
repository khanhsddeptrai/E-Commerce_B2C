import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  limit: number;
  ttlSeconds: number;
  keyPrefix?: string;
  message?: string;
}

export const RATE_LIMIT_KEY = 'RATE_LIMIT_METADATA';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
