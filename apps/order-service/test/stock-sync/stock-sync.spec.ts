import { status } from '@grpc/grpc-js';
import { PrismaOrderService } from '../../src/prisma/prisma-order.service';
import { MAX_ATTEMPTS, retryDelayMs, StockSyncService } from '../../src/stock-sync/stock-sync.service';
import { StockSyncWorker } from '../../src/stock-sync/stock-sync.worker';
import { createOrder, FakeInventoryClient, grpcError, resetOrderDb, UNAVAILABLE } from '../helpers';

describe('StockSyncService – đồng bộ thao tác kho với Product Service', () => {
  let prisma: PrismaOrderService;
  let inventory: FakeInventoryClient;
  let sync: StockSyncService;

  beforeAll(async () => {
    prisma = new PrismaOrderService();
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetOrderDb(prisma);
    inventory = new FakeInventoryClient();
    sync = new StockSyncService(prisma, inventory);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const enqueue = (orderId: string, action: 'COMMIT' | 'RELEASE' | 'SHIP' | 'RETURN', payload?: object) =>
    prisma.$transaction((tx) => sync.enqueue(tx, orderId, action, 'ADMIN_test', payload));

  const tasksOf = (orderId: string) => prisma.stockSyncTask.findMany({ where: { orderId }, orderBy: { seq: 'asc' } });

  const secondsLater = (s: number) => new Date(Date.now() + s * 1000);

  it('COMMIT thành công: gọi commitStock với mã đơn + danh sách SKU (gộp SKU trùng), task DONE', async () => {
    const order = await createOrder(prisma, {
      items: [
        { skuId: '00000000-0000-4000-8000-0000000000a1', quantity: 1 },
        { skuId: '00000000-0000-4000-8000-0000000000a1', quantity: 2 },
        { skuId: '00000000-0000-4000-8000-0000000000b2', quantity: 1 },
      ],
    });
    await enqueue(order.id, 'COMMIT');

    await sync.processOrder(order.id);

    expect(inventory.callsOf('commitStock')).toEqual([
      {
        order_id: order.id,
        order_code: order.orderCode,
        items: [
          { sku_id: '00000000-0000-4000-8000-0000000000a1', quantity: 3 },
          { sku_id: '00000000-0000-4000-8000-0000000000b2', quantity: 1 },
        ],
      },
    ]);
    expect(await tasksOf(order.id)).toEqual([expect.objectContaining({ status: 'DONE', attempts: 1, lastError: null })]);
    expect((await sync.getSyncStates([order.id])).get(order.id)).toEqual({ status: 'OK' });
  });

  it('các action gửi đúng dữ liệu: RELEASE kèm lý do, SHIP kèm người thực hiện, RETURN kèm hàng hoàn một phần', async () => {
    const order = await createOrder(prisma);
    await enqueue(order.id, 'RELEASE', { reason: 'Khách hủy' });
    await enqueue(order.id, 'SHIP');
    await enqueue(order.id, 'RETURN', { items: [{ sku_id: 'sku-1', quantity: 1 }], note: '1 cái hỏng' });

    await sync.processOrder(order.id);

    expect(inventory.callsOf('releaseStock')).toEqual([{ order_id: order.id, reason: 'Khách hủy' }]);
    expect(inventory.callsOf('shipStock')).toEqual([{ order_id: order.id, performed_by: 'ADMIN_test' }]);
    expect(inventory.callsOf('receiveReturn')).toEqual([
      { order_id: order.id, performed_by: 'ADMIN_test', items: [{ sku_id: 'sku-1', quantity: 1 }], note: '1 cái hỏng' },
    ]);
  });

  it('task của cùng một đơn chạy đúng thứ tự tạo, kể cả khi tạo trong cùng transaction', async () => {
    const order = await createOrder(prisma);
    await prisma.$transaction(async (tx) => {
      await sync.enqueue(tx, order.id, 'COMMIT', 'SYSTEM');
      await sync.enqueue(tx, order.id, 'SHIP', 'SYSTEM');
      await sync.enqueue(tx, order.id, 'RETURN', 'SYSTEM');
    });

    await sync.processOrder(order.id);

    expect(inventory.calls.map((c) => c.method)).toEqual(['commitStock', 'shipStock', 'receiveReturn']);
  });

  it('lỗi #8 – Product Service ngừng hoạt động: task chờ thử lại, không chạy task sau; hoạt động lại thì worker hoàn tất', async () => {
    const order = await createOrder(prisma);
    await enqueue(order.id, 'COMMIT');
    await enqueue(order.id, 'SHIP');
    inventory.always('commitStock', UNAVAILABLE);

    await sync.processOrder(order.id);

    let [commit, ship] = await tasksOf(order.id);
    expect(commit).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'Product Service không phản hồi' });
    expect(commit!.nextRetryAt.getTime()).toBeGreaterThan(Date.now() + 20_000); // backoff ~30 giây
    expect(ship).toMatchObject({ status: 'PENDING', attempts: 0 });
    expect(inventory.callsOf('shipStock')).toHaveLength(0);
    expect((await sync.getSyncStates([order.id])).get(order.id)?.status).toBe('PENDING');

    // Product Service hoạt động lại, worker chạy sau khi hết thời gian chờ
    inventory.always('commitStock', 'ok');
    await sync.processDue(secondsLater(120));

    [commit, ship] = await tasksOf(order.id);
    expect(commit).toMatchObject({ status: 'DONE', attempts: 2 });
    expect(ship).toMatchObject({ status: 'DONE' });
    expect(inventory.callsOf('commitStock')).toHaveLength(2);
  });

  it('chưa tới thời điểm thử lại: worker không gọi lại', async () => {
    const order = await createOrder(prisma);
    await enqueue(order.id, 'COMMIT');
    inventory.queue('commitStock', UNAVAILABLE);
    await sync.processOrder(order.id);

    await sync.processDue(new Date());

    expect(inventory.callsOf('commitStock')).toHaveLength(1);
  });

  it('backoff tăng dần từ 30 giây, tối đa 10 phút', () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(3)).toBe(120_000);
    expect(retryDelayMs(10)).toBe(600_000);
  });

  it(`lỗi tạm thời quá ${MAX_ATTEMPTS} lần: chuyển FAILED`, async () => {
    const order = await createOrder(prisma);
    const task = await enqueue(order.id, 'COMMIT');
    await prisma.stockSyncTask.update({ where: { id: task.id }, data: { attempts: MAX_ATTEMPTS - 1 } });
    inventory.always('commitStock', UNAVAILABLE);

    await sync.processOrder(order.id);

    expect(await tasksOf(order.id)).toEqual([expect.objectContaining({ status: 'FAILED', attempts: MAX_ATTEMPTS })]);
  });

  it.each([
    ['hết hàng (mục 5.1c)', status.RESOURCE_EXHAUSTED, 'Sản phẩm "Aula F75 (Đen)" không đủ số lượng tồn kho'],
    ['sai trạng thái', status.FAILED_PRECONDITION, 'Đơn hàng chưa được chốt, không thể xuất kho'],
  ])('lỗi nghiệp vụ – %s: FAILED ngay, không thử lại, chặn các task sau', async (_label, code, details) => {
    const order = await createOrder(prisma);
    await enqueue(order.id, 'COMMIT');
    await enqueue(order.id, 'SHIP');
    inventory.always('commitStock', () => grpcError(code, details));

    await sync.processOrder(order.id);
    await sync.processDue(secondsLater(3600));

    const [commit, ship] = await tasksOf(order.id);
    expect(commit).toMatchObject({ status: 'FAILED', attempts: 1, lastError: details });
    expect(ship).toMatchObject({ status: 'PENDING', attempts: 0 });
    expect(inventory.callsOf('commitStock')).toHaveLength(1);
    expect((await sync.getSyncStates([order.id])).get(order.id)).toEqual({ status: 'FAILED', error: details });
  });

  it('admin thử lại: FAILED → chạy lại ngay, thành công thì chạy tiếp các task sau', async () => {
    const order = await createOrder(prisma);
    await enqueue(order.id, 'COMMIT');
    await enqueue(order.id, 'SHIP');
    inventory.queue('commitStock', () => grpcError(status.RESOURCE_EXHAUSTED, 'Hết hàng'));
    await sync.processOrder(order.id);

    const state = await sync.retryOrder(order.id);

    expect(state).toEqual({ status: 'OK' });
    expect((await tasksOf(order.id)).map((t) => t.status)).toEqual(['DONE', 'DONE']);
  });

  it('xử lý đồng thời cùng một đơn (worker + request): mỗi task chỉ gọi RPC một lần', async () => {
    // Lặp nhiều vòng với 10 tiến trình để chắc chắn có tranh chấp thật (một vòng đơn lẻ có thể chạy tuần tự do may rủi)
    for (let round = 0; round < 3; round++) {
      const order = await createOrder(prisma);
      await enqueue(order.id, 'COMMIT');
      const before = inventory.callsOf('commitStock').length;

      await Promise.all(Array.from({ length: 10 }, () => sync.processOrder(order.id)));

      expect(inventory.callsOf('commitStock').length - before).toBe(1);
      expect(await tasksOf(order.id)).toEqual([expect.objectContaining({ status: 'DONE', attempts: 1 })]);
    }
  });

  it('getSyncStates: đơn không có task là OK; FAILED được ưu tiên hơn PENDING', async () => {
    const clean = await createOrder(prisma);
    const failed = await createOrder(prisma);
    await enqueue(failed.id, 'COMMIT');
    await enqueue(failed.id, 'SHIP');
    inventory.queue('commitStock', () => grpcError(status.FAILED_PRECONDITION, 'Sai trạng thái'));
    await sync.processOrder(failed.id);

    const states = await sync.getSyncStates([clean.id, failed.id]);

    expect(states.get(clean.id)).toEqual({ status: 'OK' });
    expect(states.get(failed.id)).toEqual({ status: 'FAILED', error: 'Sai trạng thái' });
  });

  it('worker: lỗi bất ngờ không làm dừng worker, các lần chạy chồng nhau bị bỏ qua', async () => {
    const worker = new StockSyncWorker(sync);
    const order = await createOrder(prisma);
    await enqueue(order.id, 'COMMIT');

    const [first, second] = await Promise.all([worker.tick(), worker.tick()]);

    expect(first + second).toBe(1);
    expect(inventory.callsOf('commitStock')).toHaveLength(1);
  });
});
