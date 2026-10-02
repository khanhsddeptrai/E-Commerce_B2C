import Redis from 'ioredis';

export const TEST_REDIS_DB = 14;

export function createTestRedis(): Redis {
  return new Redis(process.env.REDIS_URL as string);
}

/** Xóa Redis DB dành riêng cho test — từ chối nếu không đúng DB test */
export async function flushTestRedis(redis: Redis): Promise<void> {
  if (redis.options.db !== TEST_REDIS_DB) {
    throw new Error(`Từ chối FLUSHDB trên Redis DB ${redis.options.db}: chỉ được dùng DB ${TEST_REDIS_DB} cho test`);
  }
  await redis.flushdb();
}
