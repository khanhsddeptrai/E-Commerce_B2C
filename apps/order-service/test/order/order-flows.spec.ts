import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { ExpiredOrderWorker } from '../../src/order/expired-order.worker';
import { OrderService, PAYMENT_WINDOW_SECONDS } from '../../src/order/order.service';
import { PrismaOrderService } from '../../src/prisma/prisma-order.service';
import { StockSyncService } from '../../src/stock-sync/stock-sync.service';
import { FakeInventoryClient, grpcError, resetOrderDb, skuFixture, UNAVAILABLE } from '../helpers';

const SKU_A = '00000000-0000-4000-8000-0000000000a1';
const SKU_B = '00000000-0000-4000-8000-0000000000b2';
const CUSTOMER = '00000000-0000-4000-8000-000000000001';

async function expectRpcError(promise: Promise<unknown>, code: number, pattern?: RegExp) {
  let caught: unknown;
  try {
    await promise;
  } catch (err: unknown) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(RpcException);
  const error = (caught as RpcException).getError() as { code: number; message: string };
  expect(error.code).toBe(code);
  if (pattern) expect(error.message).toMatch(pattern);
}

describe('OrderService – luồng đơn hàng với InventoryService', () => {
  let prisma: PrismaOrderService;
  let inventory: FakeInventoryClient;
  let sync: StockSyncService;
  let service: OrderService;

  beforeAll(async () => {
    prisma = new PrismaOrderService();
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetOrderDb(prisma);
    inventory = new FakeInventoryClient();
    inventory.skus = [skuFixture(SKU_A, { price: 200000 }), skuFixture(SKU_B, { price: 150000, sku_name: 'Trắng' })];
    sync = new StockSyncService(prisma, inventory);
    service = new OrderService(prisma, sync, inventory);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const placeOrder = (paymentMethod: 'COD' | 'VNPAY', items = [{ sku_id: SKU_A, quantity: 2 }]) =>
    service.createOrder({
      customer_id: CUSTOMER,
      customer_name: 'Khách Test',
      customer_phone: '0900000000',
      customer_email: 'test@example.test',
      shipping_address_json: '{"address":"1 Lê Lợi"}',
      payment_method: paymentMethod,
      note: 'Giao giờ hành chính',
      items,
    });

  const methodsCalled = () => inventory.calls.map((c) => c.method).filter((m) => m !== 'getSkusForOrder');
  const tasksOf = (orderId: string) => prisma.stockSyncTask.findMany({ where: { orderId }, orderBy: { seq: 'asc' } });
  const statusOf = async (orderId: string) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).orderStatus;

  // ---------- Tạo đơn ----------

  describe('createOrder', () => {
    it('VNPAY: giữ hàng trước khi ghi đơn (TTL 15 phút), đơn PENDING, chưa chốt', async () => {
      const res = await placeOrder('VNPAY', [
        { sku_id: SKU_A, quantity: 1 },
        { sku_id: SKU_A, quantity: 1 },
        { sku_id: SKU_B, quantity: 1 },
      ]);

      const order = res.order!;
      expect(order).toMatchObject({ order_status: 'PENDING', stock_sync_status: 'OK', subtotal_amount: 550000 });
      expect(inventory.callsOf('holdStock')).toEqual([
        {
          order_id: order.id,
          order_code: order.order_code,
          items: [
            { sku_id: SKU_A, quantity: 2 },
            { sku_id: SKU_B, quantity: 1 },
          ],
          ttl_seconds: PAYMENT_WINDOW_SECONDS,
        },
      ]);
      expect(methodsCalled()).toEqual(['holdStock']);
      expect(await tasksOf(order.id)).toHaveLength(0);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).note).toBe('Giao giờ hành chính');
    });

    it('COD: giữ hàng rồi chốt ngay qua task COMMIT, đơn CONFIRMED', async () => {
      const res = await placeOrder('COD');

      expect(res.order).toMatchObject({ order_status: 'CONFIRMED', stock_sync_status: 'OK' });
      expect(methodsCalled()).toEqual(['holdStock', 'commitStock']);
      expect(await tasksOf(res.order!.id)).toEqual([expect.objectContaining({ action: 'COMMIT', status: 'DONE' })]);
    });

    it('COD khi kho tạm không phản hồi lúc chốt: đơn vẫn tạo, task chờ thử lại', async () => {
      inventory.queue('commitStock', UNAVAILABLE);

      const res = await placeOrder('COD');

      expect(res.order).toMatchObject({ order_status: 'CONFIRMED', stock_sync_status: 'PENDING' });
      expect(await tasksOf(res.order!.id)).toEqual([expect.objectContaining({ action: 'COMMIT', status: 'PENDING' })]);
    });

    it('hết hàng: trả RESOURCE_EXHAUSTED với thông báo của kho, không tạo đơn', async () => {
      inventory.queue('holdStock', () =>
        grpcError(status.RESOURCE_EXHAUSTED, 'Sản phẩm "Bàn phím Aula F75 (Đen)" không đủ số lượng tồn kho'),
      );

      await expectRpcError(placeOrder('VNPAY'), status.RESOURCE_EXHAUSTED, /không đủ số lượng tồn kho/);
      expect(await prisma.order.count()).toBe(0);
    });

    it('kho không phản hồi khi giữ hàng: UNAVAILABLE, không tạo đơn', async () => {
      inventory.queue('holdStock', UNAVAILABLE);

      await expectRpcError(placeOrder('VNPAY'), status.UNAVAILABLE, /kho tạm thời không phản hồi/);
      expect(await prisma.order.count()).toBe(0);
    });

    it('SKU không tồn tại hoặc ngừng bán: NOT_FOUND, không giữ hàng', async () => {
      inventory.skus = [skuFixture(SKU_A, { is_active: false })];

      await expectRpcError(placeOrder('VNPAY'), status.NOT_FOUND);
      expect(inventory.callsOf('holdStock')).toHaveLength(0);
    });

    it('ghi đơn thất bại sau khi đã giữ hàng: nhả lại hàng vừa giữ', async () => {
      const spy = jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('Mất kết nối database'));

      await expect(placeOrder('VNPAY')).rejects.toThrow('Mất kết nối database');

      spy.mockRestore();
      const holdOrderId = (inventory.callsOf('holdStock')[0] as { order_id: string }).order_id;
      expect(inventory.callsOf('releaseStock')).toEqual([{ order_id: holdOrderId, reason: 'Ghi đơn hàng thất bại' }]);
    });

    it('số lượng không hợp lệ: INVALID_ARGUMENT', async () => {
      await expectRpcError(placeOrder('COD', [{ sku_id: SKU_A, quantity: 0 }]), status.INVALID_ARGUMENT);
    });
  });

  // ---------- Thanh toán ----------

  describe('thanh toán', () => {
    it('thành công: PENDING → CONFIRMED + PAID, chốt hàng', async () => {
      const order = (await placeOrder('VNPAY')).order!;

      const res = await service.processPaymentSuccess({ order_code: order.order_code, transaction_no: 'GD1', amount: 1, payment_method: 'VNPAY' });

      expect(res.order).toMatchObject({ order_status: 'CONFIRMED', payment_status: 'PAID', stock_sync_status: 'OK' });
      expect(inventory.callsOf('commitStock')).toHaveLength(1);
    });

    it('IPN và trang kết quả cùng báo thành công: chỉ chốt hàng một lần', async () => {
      const order = (await placeOrder('VNPAY')).order!;
      const input = { order_code: order.order_code, transaction_no: 'GD1', amount: 1, payment_method: 'VNPAY' };

      await Promise.all(Array.from({ length: 5 }, () => service.processPaymentSuccess(input)));

      expect(inventory.callsOf('commitStock')).toHaveLength(1);
      expect(await tasksOf(order.id)).toHaveLength(1);
      expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id, changedBy: 'PAYMENT_SERVICE' } })).toBe(1);
    });

    it('thanh toán thành công khi đơn đã bị hủy do quá hạn: khôi phục CONFIRMED và chốt lại hàng', async () => {
      const order = (await placeOrder('VNPAY')).order!;
      await new ExpiredOrderWorker(prisma, sync).processExpiredOrders(new Date(Date.now() + (PAYMENT_WINDOW_SECONDS + 60) * 1000));
      expect(await statusOf(order.id)).toBe('CANCELLED');

      const res = await service.processPaymentSuccess({ order_code: order.order_code, transaction_no: 'GD-TRE', amount: 1, payment_method: 'VNPAY' });

      expect(res.order).toMatchObject({ order_status: 'CONFIRMED', payment_status: 'PAID', cancel_reason: undefined });
      expect(methodsCalled()).toEqual(['holdStock', 'releaseStock', 'commitStock']);
    });

    it('thanh toán trễ nhưng đã hết hàng (mục 5.1c): đơn CONFIRMED + PAID kèm cảnh báo FAILED cho admin', async () => {
      const order = (await placeOrder('VNPAY')).order!;
      inventory.queue('commitStock', () => grpcError(status.RESOURCE_EXHAUSTED, 'Sản phẩm không đủ số lượng tồn kho'));

      const res = await service.processPaymentSuccess({ order_code: order.order_code, transaction_no: 'GD1', amount: 1, payment_method: 'VNPAY' });

      expect(res.order).toMatchObject({
        order_status: 'CONFIRMED',
        payment_status: 'PAID',
        stock_sync_status: 'FAILED',
        stock_sync_error: 'Sản phẩm không đủ số lượng tồn kho',
      });
    });

    it('đơn đã được admin xác nhận trước khi thanh toán: chỉ ghi nhận PAID, không chốt lại hàng', async () => {
      const order = (await placeOrder('VNPAY')).order!;
      await service.updateDeliveryStatus({ order_id: order.id, new_status: 'CONFIRMED', changed_by: 'ADMIN_a' });

      await service.processPaymentSuccess({ order_code: order.order_code, transaction_no: 'GD1', amount: 1, payment_method: 'VNPAY' });

      expect(inventory.callsOf('commitStock')).toHaveLength(1);
      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ orderStatus: 'CONFIRMED', paymentStatus: 'PAID' });
    });

    it('thất bại: PENDING → CANCELLED + FAILED, nhả hàng', async () => {
      const order = (await placeOrder('VNPAY')).order!;

      await service.processPaymentFailed({ order_code: order.order_code, reason: 'VNPAY mã lỗi 24' });

      expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ orderStatus: 'CANCELLED', paymentStatus: 'FAILED' });
      expect(inventory.callsOf('releaseStock')).toEqual([{ order_id: order.id, reason: 'VNPAY mã lỗi 24' }]);
    });

    it('báo thất bại đến sau khi đã thanh toán thành công: bỏ qua, không hủy đơn', async () => {
      const order = (await placeOrder('VNPAY')).order!;
      await service.processPaymentSuccess({ order_code: order.order_code, transaction_no: 'GD1', amount: 1, payment_method: 'VNPAY' });

      await service.processPaymentFailed({ order_code: order.order_code, reason: 'IPN trễ' });

      expect(await statusOf(order.id)).toBe('CONFIRMED');
      expect(inventory.callsOf('releaseStock')).toHaveLength(0);
    });
  });

  // ---------- Khách hủy & quá hạn ----------

  describe('hủy đơn', () => {
    it('khách hủy đơn COD đã chốt (lỗi #3): nhả hàng', async () => {
      const order = (await placeOrder('COD')).order!;

      await service.cancelOrder({ order_id: order.id, customer_id: CUSTOMER, reason: 'Đổi ý' });

      expect(await statusOf(order.id)).toBe('CANCELLED');
      expect(inventory.callsOf('releaseStock')).toEqual([{ order_id: order.id, reason: 'Đổi ý' }]);
    });

    it('không cho khách hủy đơn đang giao', async () => {
      const order = (await placeOrder('COD')).order!;
      await service.updateDeliveryStatus({ order_id: order.id, new_status: 'SHIPPING', changed_by: 'ADMIN_a' });

      await expectRpcError(service.cancelOrder({ order_id: order.id, customer_id: CUSTOMER, reason: '' }), status.FAILED_PRECONDITION);
    });

    it('worker hủy đơn VNPAY quá 15 phút chưa thanh toán và nhả hàng; không đụng đơn COD / đơn còn hạn', async () => {
      const expired = (await placeOrder('VNPAY')).order!;
      const cod = (await placeOrder('COD')).order!;
      const later = new Date(Date.now() + (PAYMENT_WINDOW_SECONDS + 60) * 1000);

      const cancelled = await new ExpiredOrderWorker(prisma, sync).processExpiredOrders(later);
      const fresh = (await placeOrder('VNPAY')).order!;
      const again = await new ExpiredOrderWorker(prisma, sync).processExpiredOrders(new Date());

      expect(cancelled).toBe(1);
      expect(again).toBe(0);
      expect(await statusOf(expired.id)).toBe('CANCELLED');
      expect(await statusOf(cod.id)).toBe('CONFIRMED');
      expect(await statusOf(fresh.id)).toBe('PENDING');
      expect(inventory.callsOf('releaseStock')).toEqual([{ order_id: expired.id, reason: 'Quá hạn thanh toán 15 phút' }]);
    });
  });

  // ---------- Vận chuyển & hàng hoàn ----------

  describe('updateDeliveryStatus', () => {
    const update = (orderId: string, newStatus: string) =>
      service.updateDeliveryStatus({ order_id: orderId, new_status: newStatus, changed_by: 'ADMIN_a@test' });

    it('admin xác nhận đơn chưa thanh toán (lỗi #4): chốt hàng', async () => {
      const order = (await placeOrder('VNPAY')).order!;

      await update(order.id, 'CONFIRMED');

      expect(inventory.callsOf('commitStock')).toHaveLength(1);
    });

    it('bàn giao shipper: xuất kho với người thực hiện, ghi hãng + mã vận đơn', async () => {
      const order = (await placeOrder('COD')).order!;

      const res = await service.updateDeliveryStatus({
        order_id: order.id,
        new_status: 'SHIPPING',
        carrier_name: 'GHTK',
        tracking_code: 'GHTK123',
        changed_by: 'ADMIN_a@test',
      });

      expect(res.order).toMatchObject({ order_status: 'SHIPPING', carrier_name: 'GHTK', tracking_code: 'GHTK123' });
      expect(inventory.callsOf('shipStock')).toEqual([{ order_id: order.id, performed_by: 'ADMIN_a@test' }]);
    });

    it('ghi chú nội bộ của admin khi đổi trạng thái không ghi đè ghi chú của khách', async () => {
      const order = (await placeOrder('COD')).order!;

      const res = await service.updateDeliveryStatus({
        order_id: order.id,
        new_status: 'SHIPPING',
        note: 'Ghi chú nội bộ của kho',
        changed_by: 'ADMIN_a@test',
      });

      expect(res.order?.note).toBe('Giao giờ hành chính');
      expect(res.order?.status_history?.some((h) => h.note === 'Ghi chú nội bộ của kho')).toBe(true);
      expect((await service.getOrderById({ order_id: order.id, customer_id: CUSTOMER })).order?.note).toBe(
        'Giao giờ hành chính'
      );
    });

    it('cập nhật vị trí khi đang giao: không xuất kho lần nữa', async () => {
      const order = (await placeOrder('COD')).order!;
      await update(order.id, 'SHIPPING');

      await service.updateDeliveryStatus({ order_id: order.id, new_status: 'SHIPPING', location: 'Bưu cục Q1', changed_by: 'CARRIER' });

      expect(inventory.callsOf('shipStock')).toHaveLength(1);
    });

    it('giao thành công đơn COD: đánh dấu PAID; giao thẳng từ CONFIRMED thì xuất kho trước', async () => {
      const order = (await placeOrder('COD')).order!;

      const res = await update(order.id, 'DELIVERED');

      expect(res.order).toMatchObject({ order_status: 'DELIVERED', payment_status: 'PAID' });
      expect(methodsCalled()).toEqual(['holdStock', 'commitStock', 'shipStock']);
    });

    it('admin hủy đơn đã chốt chưa xuất kho: nhả hàng', async () => {
      const order = (await placeOrder('COD')).order!;

      await update(order.id, 'CANCELLED');

      expect(inventory.callsOf('releaseStock')).toHaveLength(1);
    });

    it('giao thất bại (lỗi #5): SHIPPING → CANCELLED không đụng kho; nhận hàng hoàn → RETURNED nhập lại kho', async () => {
      const order = (await placeOrder('COD')).order!;
      await update(order.id, 'SHIPPING');

      await update(order.id, 'CANCELLED');
      expect(inventory.callsOf('releaseStock')).toHaveLength(0);
      expect(inventory.callsOf('receiveReturn')).toHaveLength(0);

      const res = await update(order.id, 'RETURNED');
      expect(res.order).toMatchObject({ order_status: 'RETURNED', stock_sync_status: 'OK' });
      expect(inventory.callsOf('receiveReturn')).toEqual([
        { order_id: order.id, performed_by: 'ADMIN_a@test', items: [], note: '' },
      ]);
    });

    it('khách trả hàng sau khi đã giao: DELIVERED → RETURNED', async () => {
      const order = (await placeOrder('COD')).order!;
      await update(order.id, 'DELIVERED');

      await update(order.id, 'RETURNED');

      expect(inventory.callsOf('receiveReturn')).toHaveLength(1);
    });

    it.each([
      ['xác nhận hàng hoàn cho đơn chưa xuất kho', 'COD', [], 'RETURNED'],
      ['xuất kho đơn chưa thanh toán / chưa chốt', 'VNPAY', [], 'SHIPPING'],
      ['đổi trạng thái đơn đã nhận hàng hoàn', 'COD', ['DELIVERED', 'RETURNED'], 'CONFIRMED'],
      ['hủy đơn đã giao thành công', 'COD', ['DELIVERED'], 'CANCELLED'],
    ] as const)('không hợp lệ – %s: FAILED_PRECONDITION', async (_label, method, steps, target) => {
      const order = (await placeOrder(method)).order!;
      for (const step of steps) await update(order.id, step);

      await expectRpcError(update(order.id, target), status.FAILED_PRECONDITION);
    });

    it('hai admin cùng thao tác trên một đơn: chỉ một thao tác được ghi, thao tác còn lại báo ABORTED', async () => {
      const order = (await placeOrder('COD')).order!;

      const results = await Promise.allSettled(Array.from({ length: 5 }, () => update(order.id, 'SHIPPING')));

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      // Thao tác đến sau thấy đơn đã SHIPPING → chỉ là cập nhật vị trí; thao tác chạy song song thật → ABORTED
      for (const r of rejected) {
        expect(((r.reason as RpcException).getError() as { code: number }).code).toBe(status.ABORTED);
      }
      expect(inventory.callsOf('shipStock')).toHaveLength(1);
    });
  });

  // ---------- Hiển thị ----------

  it('danh sách đơn kèm trạng thái đồng bộ kho của từng đơn', async () => {
    const ok = (await placeOrder('COD')).order!;
    inventory.queue('commitStock', () => grpcError(status.RESOURCE_EXHAUSTED, 'Hết hàng'));
    const failed = (await placeOrder('COD')).order!;

    const res = await service.getOrdersByCustomer({ customer_id: CUSTOMER, page: 1, limit: 10 });

    const byId = new Map(res.orders.map((o) => [o.id, o]));
    expect(byId.get(ok.id)?.stock_sync_status).toBe('OK');
    expect(byId.get(failed.id)).toMatchObject({ stock_sync_status: 'FAILED', stock_sync_error: 'Hết hàng' });
  });
});
