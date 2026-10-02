import Redis from 'ioredis';
import { RESERVE_STOCK_LUA } from '../../src/order/order.service';
import { createTestRedis, flushTestRedis } from '../helpers';

// Đặc tả hành vi Lua giữ kho hiện tại (sẽ chuyển sang Product Service ở Bước 2 – docs/06-wms-implementation-plan.md)
describe('RESERVE_STOCK_LUA – giữ kho nguyên tử trên Redis', () => {
  let redis: Redis;
  const stockKey = 'stock:sku-test';

  const reserve = (quantity: number, client: Redis = redis) =>
    client.eval(RESERVE_STOCK_LUA, 1, stockKey, quantity) as Promise<number>;

  beforeAll(() => {
    redis = createTestRedis();
  });

  beforeEach(async () => {
    await flushTestRedis(redis);
  });

  afterAll(() => {
    redis.disconnect();
  });

  it('đủ hàng: trả 1 và trừ tồn', async () => {
    await redis.set(stockKey, 5);

    expect(await reserve(3)).toBe(1);
    expect(await redis.get(stockKey)).toBe('2');
  });

  it('mua đúng bằng số tồn còn lại: trả 1 và tồn về 0', async () => {
    await redis.set(stockKey, 2);

    expect(await reserve(2)).toBe(1);
    expect(await redis.get(stockKey)).toBe('0');
  });

  it('thiếu hàng: trả 0 và giữ nguyên tồn', async () => {
    await redis.set(stockKey, 2);

    expect(await reserve(3)).toBe(0);
    expect(await redis.get(stockKey)).toBe('2');
  });

  it('chưa có key tồn trên Redis: trả 0 và không tạo key', async () => {
    expect(await reserve(1)).toBe(0);
    expect(await redis.exists(stockKey)).toBe(0);
  });

  it('nhiều khách cùng tranh sản phẩm cuối cùng: chỉ đúng 1 người giữ được', async () => {
    await redis.set(stockKey, 1);
    // Mỗi khách một kết nối riêng để mô phỏng các request đồng thời thật
    const clients = Array.from({ length: 20 }, () => createTestRedis());

    try {
      const results = await Promise.all(clients.map((c) => reserve(1, c)));

      expect(results.filter((r) => r === 1)).toHaveLength(1);
      expect(await redis.get(stockKey)).toBe('0');
    } finally {
      clients.forEach((c) => c.disconnect());
    }
  });

  it('nhiều khách mua cùng lúc: tổng đã giữ không vượt quá tồn', async () => {
    await redis.set(stockKey, 10);
    const clients = Array.from({ length: 15 }, () => createTestRedis());

    try {
      // 15 khách, mỗi người mua 1 → chỉ 10 người thành công
      const results = await Promise.all(clients.map((c) => reserve(1, c)));

      expect(results.filter((r) => r === 1)).toHaveLength(10);
      expect(await redis.get(stockKey)).toBe('0');
    } finally {
      clients.forEach((c) => c.disconnect());
    }
  });
});
