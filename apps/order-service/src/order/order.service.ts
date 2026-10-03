import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { randomUUID } from 'crypto';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { OrderPrisma } from '@repo/database';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  GetOrderByIdRequest,
  GetOrderByIdResponse,
  GetOrdersByCustomerRequest,
  GetOrdersByCustomerResponse,
  CancelOrderRequest,
  CancelOrderResponse,
  InventoryServiceClient,
  OrderSkuDto,
  ProcessPaymentSuccessRequest,
  ProcessPaymentSuccessResponse,
  ProcessPaymentFailedRequest,
  ProcessPaymentFailedResponse,
  StockItem,
  UpdateDeliveryStatusRequest,
  UpdateDeliveryStatusResponse,
  OrderDto,
} from '@repo/proto';
import { PrismaOrderService } from '../prisma/prisma-order.service';
import { INVENTORY_CLIENT } from '../stock-sync/inventory-client';
import { errorMessageOf, grpcCodeOf, StockSyncService, StockSyncState } from '../stock-sync/stock-sync.service';

/** Thời gian giữ hàng chờ thanh toán trực tuyến (khớp với thời hạn thanh toán của đơn) */
export const PAYMENT_WINDOW_SECONDS = 15 * 60;
const RPC_TIMEOUT_MS = 10_000;

type OrderStatus = OrderPrisma.OrderStatus;
type Tx = OrderPrisma.Prisma.TransactionClient;
type OrderWithItems = OrderPrisma.Prisma.OrderGetPayload<{
  include: {
    items: true;
  };
}> & {
  statusHistory?: OrderPrisma.Prisma.OrderStatusHistoryGetPayload<object>[];
};

const ORDER_INCLUDE = {
  items: true,
  statusHistory: { orderBy: { createdAt: 'asc' } },
} as const;

/** Đơn đã chốt nhưng chưa xuất kho: hủy thì nhả hàng */
const CANCELLABLE_BEFORE_SHIPPING: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING'];

function rpcError(code: status, message: string): RpcException {
  return new RpcException({ code, message });
}

/** Thao tác trên đơn trùng với một thao tác khác vừa xảy ra (cập nhật có điều kiện không khớp) */
function concurrentUpdateError(): RpcException {
  return rpcError(status.ABORTED, 'Đơn hàng vừa được cập nhật bởi thao tác khác, vui lòng tải lại và thử lại');
}

/**
 * Nghiệp vụ đơn hàng. Mọi thay đổi tồn kho đi qua InventoryService (Product Service):
 * - Tạo đơn: giữ hàng đồng bộ TRƯỚC khi ghi đơn (cần trả lời khách còn hàng hay không).
 * - Sau đó: đổi trạng thái đơn + ghi task kho trong CÙNG transaction, rồi StockSyncService gọi RPC và thử lại tới khi xong.
 * Xem docs/06-wms-implementation-plan.md (mục 5.1 và thiết kế Bước 3).
 */
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaOrderService,
    private readonly stockSync: StockSyncService,
    @Inject(INVENTORY_CLIENT) private readonly inventory: InventoryServiceClient,
  ) {}

  /**
   * Sinh mã đơn hàng theo chuẩn: ORD-YYMMDD-XXXX
   * Ví dụ: ORD-260920-8H2K
   */
  private generateOrderCode(): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `ORD-${yy}${mm}${dd}-${rand}`;
  }

  async createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    if (!data.items || data.items.length === 0) {
      throw rpcError(status.INVALID_ARGUMENT, 'Đơn hàng phải có ít nhất 1 sản phẩm');
    }
    for (const item of data.items) {
      if (!item.sku_id || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw rpcError(status.INVALID_ARGUMENT, 'Số lượng sản phẩm phải là số nguyên dương');
      }
    }
    const items = this.mergeItems(data.items);

    // 1. Lấy giá và thông tin SKU từ Product Service
    const { skus } = await this.callInventory(this.inventory.getSkusForOrder({ sku_ids: items.map((i) => i.sku_id) }));
    const skuMap = new Map<string, OrderSkuDto>((skus || []).map((s) => [s.id, s]));
    if (items.some((i) => !skuMap.get(i.sku_id)?.is_active)) {
      throw rpcError(status.NOT_FOUND, 'Một số sản phẩm hoặc biến thể không tồn tại hoặc đã ngừng kinh doanh');
    }

    // 2. Tính tiền
    let subtotal = 0;
    const orderItemsData = items.map((item) => {
      const sku = skuMap.get(item.sku_id)!;
      const price = Number(sku.price);
      const totalItemPrice = price * item.quantity;
      subtotal += totalItemPrice;
      return {
        skuId: sku.id,
        productId: sku.product_id,
        productName: sku.product_name,
        skuName: sku.sku_name,
        unitPrice: price,
        quantity: item.quantity,
        totalPrice: totalItemPrice,
        thumbnailUrl: sku.thumbnail_url || null,
      };
    });
    const shippingFee = subtotal >= 500000 ? 0 : 30000;
    const discountAmount = 0;
    const totalAmount = subtotal + shippingFee - discountAmount;

    let shippingAddressJson: OrderPrisma.Prisma.InputJsonValue = {};
    try {
      shippingAddressJson = JSON.parse(data.shipping_address_json || '{}') as OrderPrisma.Prisma.InputJsonObject;
    } catch {
      shippingAddressJson = { address: data.shipping_address_json };
    }

    const validPaymentMethods: Record<string, OrderPrisma.PaymentMethod> = {
      COD: OrderPrisma.PaymentMethod.COD,
      VNPAY: OrderPrisma.PaymentMethod.VNPAY,
      MOMO: OrderPrisma.PaymentMethod.MOMO,
      STRIPE: OrderPrisma.PaymentMethod.STRIPE,
    };
    const paymentMethod = validPaymentMethods[data.payment_method] || OrderPrisma.PaymentMethod.COD;
    const isCod = paymentMethod === OrderPrisma.PaymentMethod.COD;

    // 3. Sinh sẵn id / mã đơn để giữ hàng trước khi ghi đơn
    const orderId = randomUUID();
    let orderCode = this.generateOrderCode();
    while (await this.prisma.order.findUnique({ where: { orderCode }, select: { id: true } })) {
      orderCode = this.generateOrderCode();
    }

    // 4. Giữ hàng nguyên tử cho mọi SKU (hết hàng → lỗi trả thẳng cho khách, chưa ghi gì)
    await this.callInventory(
      this.inventory.holdStock({ order_id: orderId, order_code: orderCode, items, ttl_seconds: PAYMENT_WINDOW_SECONDS }),
    );

    // 5. Ghi đơn (COD: chốt luôn bằng task COMMIT trong cùng transaction)
    const initialOrderStatus = isCod ? OrderPrisma.OrderStatus.CONFIRMED : OrderPrisma.OrderStatus.PENDING;
    const initialNote = isCod
      ? 'Đơn hàng COD được xác nhận tự động - Đã chốt giữ tồn kho'
      : 'Khách hàng đặt hàng thành công - Chờ thanh toán trực tuyến trong 15 phút';

    let order: OrderWithItems;
    try {
      order = await this.prisma.$transaction(async (tx): Promise<OrderWithItems> => {
        const created = await tx.order.create({
          data: {
            id: orderId,
            orderCode,
            customerId: data.customer_id,
            customerName: data.customer_name,
            customerPhone: data.customer_phone,
            customerEmail: data.customer_email,
            shippingAddress: shippingAddressJson,
            subtotalAmount: subtotal,
            discountAmount,
            shippingFee,
            totalAmount,
            paymentMethod,
            paymentStatus: OrderPrisma.PaymentStatus.PENDING,
            orderStatus: initialOrderStatus,
            voucherCode: data.voucher_code || undefined,
            note: data.note || null,
            trackingCode: `GHN${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`,
            carrierName: 'Giao Hàng Nhanh (GHN)',
            shippingMethod: 'STANDARD',
            items: { create: orderItemsData },
            statusHistory: {
              create: {
                fromStatus: 'NONE',
                toStatus: initialOrderStatus,
                note: data.note || initialNote,
                location: 'Kho tổng Novatech Logistics',
                changedBy: data.customer_id || 'CUSTOMER',
              },
            },
          },
          include: ORDER_INCLUDE,
        });
        if (isCod) {
          await this.stockSync.enqueue(tx, orderId, 'COMMIT', 'SYSTEM_COD');
        }
        return created;
      });
    } catch (err: unknown) {
      // Bù trừ: nhả hàng vừa giữ. Nếu cũng lỗi thì lượt giữ hàng tự hết hạn sau PAYMENT_WINDOW_SECONDS
      await this.callInventory(this.inventory.releaseStock({ order_id: orderId, reason: 'Ghi đơn hàng thất bại' })).catch(
        (releaseErr: unknown) =>
          this.logger.error(`Không nhả được giữ hàng của đơn lỗi ${orderCode}: ${errorMessageOf(releaseErr)}`),
      );
      throw err;
    }

    if (isCod) await this.stockSync.processOrder(orderId);

    return {
      success: true,
      message: 'Đặt hàng thành công',
      order: await this.toDto(order),
    };
  }

  async getOrderById(data: GetOrderByIdRequest): Promise<GetOrderByIdResponse> {
    const order = await this.findOrder(data.order_id);
    if (!order) {
      throw rpcError(status.NOT_FOUND, 'Không tìm thấy đơn hàng');
    }
    return { order: await this.toDto(order) };
  }

  async getOrdersByCustomer(data: GetOrdersByCustomerRequest): Promise<GetOrdersByCustomerResponse> {
    const page = Math.max(1, data.page || 1);
    const limit = Math.max(1, Math.min(50, data.limit || 10));
    const skip = (page - 1) * limit;

    const where = data.customer_id && data.customer_id !== 'ALL' ? { customerId: data.customer_id } : {};

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: ORDER_INCLUDE,
      }),
    ]);

    const states = await this.stockSync.getSyncStates(orders.map((o) => o.id));
    return {
      orders: orders.map((o) => this.mapOrderToDto(o, states.get(o.id))),
      total,
    };
  }

  /** Khách hủy đơn: chỉ khi chưa xuất kho; nhả hàng qua task RELEASE */
  async cancelOrder(data: CancelOrderRequest): Promise<CancelOrderResponse> {
    const order = await this.prisma.order.findUnique({ where: { id: data.order_id } });
    if (!order) {
      throw rpcError(status.NOT_FOUND, 'Không tìm thấy đơn hàng để hủy');
    }
    if (order.orderStatus === 'CANCELLED') {
      return { success: true, message: 'Đơn hàng đã được hủy trước đó' };
    }
    if (!CANCELLABLE_BEFORE_SHIPPING.includes(order.orderStatus)) {
      throw rpcError(status.FAILED_PRECONDITION, 'Không thể hủy đơn hàng đang giao hoặc đã hoàn thành');
    }

    const reason = data.reason || 'Khách hàng yêu cầu hủy';
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, 'CANCELLED', {
        data: { cancelReason: reason },
        note: data.reason || 'Hủy đơn hàng',
        changedBy: data.customer_id || 'CUSTOMER',
      });
      await this.stockSync.enqueue(tx, order.id, 'RELEASE', data.customer_id || 'CUSTOMER', { reason });
    });
    await this.stockSync.processOrder(order.id);

    return { success: true, message: 'Hủy đơn hàng thành công và đã nhả lại tồn kho' };
  }

  /**
   * Thanh toán thành công (IPN / trang kết quả – có thể gọi trùng):
   * - Đơn PENDING, hoặc đã bị hủy do quá hạn → CONFIRMED + chốt hàng (task COMMIT; hết hàng → cảnh báo cho admin).
   * - Đơn đã được admin xác nhận trước khi thanh toán → chỉ ghi nhận đã thanh toán.
   */
  async processPaymentSuccess(data: ProcessPaymentSuccessRequest): Promise<ProcessPaymentSuccessResponse> {
    // Thử lại khi đơn vừa bị thao tác khác đổi trạng thái (vd worker hủy do quá hạn đúng lúc này)
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await this.tryApplyPaymentSuccess(data);
      if (result) return result;
    }
    throw concurrentUpdateError();
  }

  /** Trả null nếu đơn vừa bị đổi trạng thái giữa lúc đọc và lúc cập nhật (cần đọc lại) */
  private async tryApplyPaymentSuccess(
    data: ProcessPaymentSuccessRequest,
  ): Promise<ProcessPaymentSuccessResponse | null> {
    const order = await this.prisma.order.findUnique({ where: { orderCode: data.order_code } });
    if (!order) {
      throw rpcError(status.NOT_FOUND, `Không tìm thấy đơn hàng mã: ${data.order_code}`);
    }

    if (order.paymentStatus === OrderPrisma.PaymentStatus.PAID) {
      return {
        success: true,
        message: 'Đơn hàng đã được ghi nhận thanh toán thành công trước đó',
        order: await this.toDto((await this.findOrder(order.id))!),
      };
    }

    const reinstate = order.orderStatus === 'PENDING' || order.orderStatus === 'CANCELLED';
    const paymentNote = `Thanh toán thành công qua ${data.payment_method || 'VNPAY'} (Mã GD: ${data.transaction_no})`;

    const applied = await this.prisma.$transaction(async (tx) => {
      // Điều kiện "chưa thanh toán" chống ghi nhận trùng khi IPN và trang kết quả cùng gọi
      const res = await tx.order.updateMany({
        where: { id: order.id, paymentStatus: { not: OrderPrisma.PaymentStatus.PAID }, orderStatus: order.orderStatus },
        data: {
          paymentStatus: OrderPrisma.PaymentStatus.PAID,
          ...(reinstate ? { orderStatus: OrderPrisma.OrderStatus.CONFIRMED, cancelReason: null } : {}),
        },
      });
      if (res.count === 0) return false;

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.orderStatus,
          toStatus: reinstate ? OrderPrisma.OrderStatus.CONFIRMED : order.orderStatus,
          note:
            order.orderStatus === 'CANCELLED'
              ? `${paymentNote} – Khôi phục đơn đã hủy do quá hạn thanh toán`
              : paymentNote,
          changedBy: 'PAYMENT_SERVICE',
        },
      });
      if (reinstate) {
        await this.stockSync.enqueue(tx, order.id, 'COMMIT', 'PAYMENT_SERVICE');
      }
      return true;
    });

    if (!applied) return null;
    await this.stockSync.processOrder(order.id);

    return {
      success: true,
      message: 'Xác nhận thanh toán đơn hàng thành công',
      order: await this.toDto((await this.findOrder(order.id))!),
    };
  }

  /** Thanh toán thất bại: chỉ hủy đơn còn chờ thanh toán, nhả hàng qua task RELEASE */
  async processPaymentFailed(data: ProcessPaymentFailedRequest): Promise<ProcessPaymentFailedResponse> {
    const order = await this.prisma.order.findUnique({ where: { orderCode: data.order_code } });
    if (!order) {
      throw rpcError(status.NOT_FOUND, `Không tìm thấy đơn hàng mã: ${data.order_code}`);
    }
    if (order.orderStatus === OrderPrisma.OrderStatus.CANCELLED) {
      return { success: true, message: 'Đơn hàng đã ở trạng thái hủy trước đó' };
    }
    if (order.orderStatus !== OrderPrisma.OrderStatus.PENDING || order.paymentStatus === OrderPrisma.PaymentStatus.PAID) {
      return { success: true, message: 'Đơn hàng không còn chờ thanh toán, bỏ qua thông báo thất bại' };
    }

    const reason = data.reason || 'Thanh toán trực tuyến thất bại hoặc bị hủy bởi người dùng';
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.transition(tx, order, 'CANCELLED', {
          data: { paymentStatus: OrderPrisma.PaymentStatus.FAILED, cancelReason: reason },
          note: `Thanh toán thất bại: ${data.reason || 'Hủy giao dịch'} - Hệ thống đã nhả lại tồn kho`,
          changedBy: 'PAYMENT_SERVICE',
        });
        await this.stockSync.enqueue(tx, order.id, 'RELEASE', 'PAYMENT_SERVICE', { reason });
      });
    } catch (err: unknown) {
      // Một thông báo khác (vd thanh toán thành công) vừa cập nhật đơn trước
      if (err instanceof RpcException) return { success: true, message: 'Đơn hàng vừa được cập nhật, bỏ qua' };
      throw err;
    }
    await this.stockSync.processOrder(order.id);

    return { success: true, message: 'Hủy đơn hàng và giải phóng giữ kho thành công' };
  }

  /**
   * Admin / webhook vận chuyển cập nhật tiến trình đơn:
   * PENDING → CONFIRMED (chốt hàng) → SHIPPING (xuất kho) → DELIVERED;
   * hủy trước khi xuất kho → nhả hàng; giao thất bại (SHIPPING → CANCELLED) → chưa đụng kho;
   * xác nhận đã nhận hàng hoàn → RETURNED (nhập lại kho).
   */
  async updateDeliveryStatus(data: UpdateDeliveryStatusRequest): Promise<UpdateDeliveryStatusResponse> {
    const order = await this.findOrder(data.order_id);
    if (!order) {
      throw rpcError(status.NOT_FOUND, `Không tìm thấy đơn hàng với mã hoặc ID: ${data.order_id}`);
    }

    const current = order.orderStatus;
    const target = data.new_status as OrderStatus;
    const changedBy = data.changed_by || 'LOGISTICS_SIMULATOR';
    const updateData: OrderPrisma.Prisma.OrderUpdateManyMutationInput = {};
    let historyNote = data.note;
    let historyLocation = data.location;
    const stockActions: OrderPrisma.StockSyncAction[] = [];
    const reject = (message: string) => rpcError(status.FAILED_PRECONDITION, message);

    switch (target) {
      case 'CONFIRMED':
        if (current === 'PENDING') {
          stockActions.push('COMMIT');
        } else if (current !== 'CONFIRMED') {
          throw reject(`Không thể xác nhận đơn hàng đang ở trạng thái ${current}`);
        }
        historyNote = historyNote || 'Đơn hàng đã được xác nhận và chuẩn bị đóng gói xuất kho';
        historyLocation = historyLocation || 'Kho tổng Novatech Logistics';
        break;

      case 'SHIPPING':
        if (current === 'CONFIRMED' || current === 'PROCESSING') {
          stockActions.push('SHIP');
          updateData.shippedAt = new Date();
          updateData.carrierName = data.carrier_name || order.carrierName || 'Giao Hàng Nhanh (GHN)';
          updateData.trackingCode =
            data.tracking_code ||
            order.trackingCode ||
            `GHN${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`;
          historyNote = historyNote || `Đơn hàng đã xuất kho, bàn giao cho shipper của ${updateData.carrierName}`;
          historyLocation = historyLocation || 'Kho trung chuyển Tân Bình, TP. Hồ Chí Minh';
        } else if (current === 'SHIPPING') {
          // Cập nhật vị trí trên đường giao, không đụng kho
          if (data.carrier_name) updateData.carrierName = data.carrier_name;
          if (data.tracking_code) updateData.trackingCode = data.tracking_code;
        } else {
          throw reject(`Không thể chuyển sang đang giao khi đơn hàng ở trạng thái ${current}`);
        }
        break;

      case 'DELIVERED':
        if (current === 'CONFIRMED' || current === 'PROCESSING') {
          stockActions.push('SHIP'); // Giao thẳng: xuất kho trước khi ghi nhận giao thành công
          updateData.shippedAt = new Date();
        } else if (current !== 'SHIPPING') {
          throw reject(`Không thể ghi nhận giao thành công khi đơn hàng ở trạng thái ${current}`);
        }
        updateData.deliveredAt = new Date();
        // COD: shipper giao hàng kiêm thu tiền → đánh dấu PAID
        if (order.paymentMethod === OrderPrisma.PaymentMethod.COD && order.paymentStatus !== OrderPrisma.PaymentStatus.PAID) {
          updateData.paymentStatus = OrderPrisma.PaymentStatus.PAID;
        }
        historyNote = historyNote || 'Giao hàng thành công. Khách hàng đã nhận kiện hàng nguyên vẹn';
        historyLocation = historyLocation || 'Địa chỉ nhận hàng của khách';
        break;

      case 'CANCELLED':
        if (CANCELLABLE_BEFORE_SHIPPING.includes(current)) {
          stockActions.push('RELEASE');
          historyNote = historyNote || 'Đơn hàng đã bị hủy';
        } else if (current === 'SHIPPING') {
          // Giao thất bại: hàng đang trên đường về, chỉ nhập lại kho khi admin xác nhận đã nhận (RETURNED)
          historyNote = historyNote || 'Giao hàng thất bại, hàng đang được hoàn về kho';
        } else {
          throw reject(`Không thể hủy đơn hàng đang ở trạng thái ${current}`);
        }
        updateData.cancelReason = data.note || 'Hủy đơn hàng trong quá trình vận chuyển';
        historyLocation = historyLocation || 'Trung tâm xử lý hoàn hàng';
        break;

      case 'RETURNED':
        if (current === 'DELIVERED' || current === 'SHIPPING' || (current === 'CANCELLED' && order.shippedAt)) {
          stockActions.push('RETURN');
        } else {
          throw reject('Chỉ nhận hàng hoàn cho đơn hàng đã xuất kho');
        }
        historyNote = historyNote || 'Kho đã nhận lại hàng hoàn và nhập lại tồn kho';
        historyLocation = historyLocation || 'Kho tổng Novatech Logistics';
        break;

      default:
        throw rpcError(status.INVALID_ARGUMENT, `Trạng thái đơn hàng không hợp lệ: ${data.new_status}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, target, {
        data: updateData,
        note: historyNote,
        location: historyLocation,
        changedBy,
      });
      for (const action of stockActions) {
        await this.stockSync.enqueue(tx, order.id, action, changedBy, action === 'RELEASE' ? { reason: historyNote } : undefined);
      }
    });
    if (stockActions.length > 0) await this.stockSync.processOrder(order.id);

    return {
      success: true,
      message: `Cập nhật trạng thái đơn hàng sang ${target} thành công`,
      order: await this.toDto((await this.findOrder(order.id))!),
    };
  }

  // ---------- Nội bộ ----------

  /**
   * Đổi trạng thái đơn có điều kiện "đang ở trạng thái cũ" (chống hai thao tác đồng thời cùng ghi đè)
   * và ghi lịch sử, trong transaction của người gọi.
   */
  private async transition(
    tx: Tx,
    order: { id: string; orderStatus: OrderStatus },
    target: OrderStatus,
    opts: {
      data?: OrderPrisma.Prisma.OrderUpdateManyMutationInput;
      note?: string;
      location?: string;
      changedBy: string;
    },
  ): Promise<void> {
    const res = await tx.order.updateMany({
      where: { id: order.id, orderStatus: order.orderStatus },
      data: { ...opts.data, orderStatus: target },
    });
    if (res.count === 0) throw concurrentUpdateError();

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.orderStatus,
        toStatus: target,
        note: opts.note,
        location: opts.location,
        changedBy: opts.changedBy,
      },
    });
  }

  private async findOrder(idOrCode: string): Promise<OrderWithItems | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);
    if (isUuid) {
      const byId = await this.prisma.order.findUnique({ where: { id: idOrCode }, include: ORDER_INCLUDE });
      if (byId) return byId;
    }
    return this.prisma.order.findUnique({ where: { orderCode: idOrCode }, include: ORDER_INCLUDE });
  }

  /** Gọi InventoryService; lỗi được chuyển thành RpcException giữ nguyên mã gRPC để Gateway trả đúng HTTP */
  private async callInventory<T>(source: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(source.pipe(timeout(RPC_TIMEOUT_MS)));
    } catch (err: unknown) {
      const code = grpcCodeOf(err);
      if (code === undefined || code === status.UNAVAILABLE || code === status.DEADLINE_EXCEEDED) {
        this.logger.error(`InventoryService không phản hồi: ${errorMessageOf(err)}`);
        throw rpcError(status.UNAVAILABLE, 'Hệ thống kho tạm thời không phản hồi, vui lòng thử lại sau ít phút');
      }
      throw rpcError(code, errorMessageOf(err));
    }
  }

  private mergeItems(items: StockItem[]): StockItem[] {
    const merged = new Map<string, number>();
    for (const item of items) merged.set(item.sku_id, (merged.get(item.sku_id) ?? 0) + item.quantity);
    return [...merged.entries()].map(([sku_id, quantity]) => ({ sku_id, quantity }));
  }

  private async toDto(order: OrderWithItems): Promise<OrderDto> {
    const state = (await this.stockSync.getSyncStates([order.id])).get(order.id);
    return this.mapOrderToDto(order, state);
  }

  private mapOrderToDto(order: OrderWithItems, syncState?: StockSyncState): OrderDto {
    return {
      id: order.id,
      order_code: order.orderCode,
      customer_id: order.customerId,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      customer_email: order.customerEmail,
      shipping_address_json:
        typeof order.shippingAddress === 'string'
          ? order.shippingAddress
          : JSON.stringify(order.shippingAddress),
      subtotal_amount: Number(order.subtotalAmount),
      discount_amount: Number(order.discountAmount),
      shipping_fee: Number(order.shippingFee),
      total_amount: Number(order.totalAmount),
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      order_status: order.orderStatus,
      voucher_code: order.voucherCode || undefined,
      cancel_reason: order.cancelReason || undefined,
      // Ghi chú của khách khi đặt hàng — ghi chú nội bộ của admin nằm trong status_history
      note: order.note || undefined,
      items: order.items.map((i) => ({
        id: i.id,
        sku_id: i.skuId,
        product_id: i.productId,
        product_name: i.productName,
        sku_name: i.skuName,
        unit_price: Number(i.unitPrice),
        quantity: i.quantity,
        total_price: Number(i.totalPrice),
        thumbnail_url: i.thumbnailUrl || undefined,
      })),
      created_at: order.createdAt.toISOString(),
      tracking_code: order.trackingCode || undefined,
      carrier_name: order.carrierName || undefined,
      shipping_method: order.shippingMethod || undefined,
      shipped_at: order.shippedAt ? order.shippedAt.toISOString() : undefined,
      delivered_at: order.deliveredAt ? order.deliveredAt.toISOString() : undefined,
      status_history: (order.statusHistory || []).map((h) => ({
        id: h.id,
        from_status: h.fromStatus,
        to_status: h.toStatus,
        note: h.note || undefined,
        location: h.location || undefined,
        changed_by: h.changedBy,
        created_at: h.createdAt.toISOString(),
      })),
      stock_sync_status: syncState?.status ?? 'OK',
      stock_sync_error: syncState?.error,
    };
  }
}
