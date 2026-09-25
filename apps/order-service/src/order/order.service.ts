import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import Redis from 'ioredis';
import { PrismaOrderService } from '../prisma/prisma-order.service';
import { ProductPrismaClient, OrderPrisma } from '@repo/database';
import {
  CreateOrderRequest,
  CreateOrderResponse,
  GetOrderByIdRequest,
  GetOrderByIdResponse,
  GetOrdersByCustomerRequest,
  GetOrdersByCustomerResponse,
  CancelOrderRequest,
  CancelOrderResponse,
  ProcessPaymentSuccessRequest,
  ProcessPaymentSuccessResponse,
  ProcessPaymentFailedRequest,
  ProcessPaymentFailedResponse,
  OrderDto,
} from '@repo/proto';

const RESERVE_STOCK_LUA = `
local current_stock = tonumber(redis.call('get', KEYS[1]))
local buy_qty = tonumber(ARGV[1])

if current_stock and current_stock >= buy_qty then
    redis.call('decrby', KEYS[1], buy_qty)
    return 1
else
    return 0
end
`;

type OrderWithItems = OrderPrisma.Prisma.OrderGetPayload<{
  include: {
    items: true;
  };
}>;

@Injectable()
export class OrderService {
  private readonly redis: Redis;
  private readonly productPrisma: ProductPrismaClient;

  constructor(private readonly prisma: PrismaOrderService) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });

    this.productPrisma = new ProductPrismaClient({
      datasources: {
        db: {
          url:
            process.env.PRODUCT_DATABASE_URL ||
            'postgresql://postgres:postgrespassword@localhost:5432/product_db?schema=public',
        },
      },
    });
  }

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
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Đơn hàng phải có ít nhất 1 sản phẩm',
      });
    }

    // 1. Kiểm tra và nạp thông tin SKU từ database sản phẩm
    const skuIds = data.items.map((i) => i.sku_id);
    const dbSkus = await this.productPrisma.productSku.findMany({
      where: { id: { in: skuIds }, isActive: true },
      include: { product: true },
    });

    if (dbSkus.length !== data.items.length) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Một số sản phẩm hoặc biến thể không tồn tại hoặc đã ngừng kinh doanh',
      });
    }

    const skuMap = new Map(dbSkus.map((s) => [s.id, s]));

    // 2. Giữ kho nguyên tử (Atomic Inventory Reservation) qua Redis Lua Script
    const reservedItems: { skuId: string; quantity: number }[] = [];

    for (const item of data.items) {
      const sku = skuMap.get(item.sku_id);
      if (!sku) continue;

      const stockKey = `stock:${item.sku_id}`;

      // Nếu key chưa có trên Redis, đồng bộ số lượng tồn từ DB sang Redis
      const exists = await this.redis.exists(stockKey);
      if (!exists) {
        await this.redis.set(stockKey, sku.stockQuantity);
      }

      // Chạy Lua Script nguyên tử: Check và Decr
      const result = await this.redis.eval(
        RESERVE_STOCK_LUA,
        1,
        stockKey,
        item.quantity,
      );

      if (result === 1) {
        reservedItems.push({ skuId: item.sku_id, quantity: item.quantity });
      } else {
        // Rollback các món đã giữ trước đó
        for (const reserved of reservedItems) {
          await this.redis.incrby(`stock:${reserved.skuId}`, reserved.quantity);
        }

        throw new RpcException({
          code: status.RESOURCE_EXHAUSTED,
          message: `Sản phẩm "${sku.product.name} (${sku.name})" không đủ số lượng tồn kho`,
        });
      }
    }

    // 3. Tính toán tổng tiền
    let subtotal = 0;
    const orderItemsData = data.items.map((item) => {
      const sku = skuMap.get(item.sku_id)!;
      const price = Number(sku.price);
      const totalItemPrice = price * item.quantity;
      subtotal += totalItemPrice;

      return {
        skuId: sku.id,
        productId: sku.productId,
        productName: sku.product.name,
        skuName: sku.name,
        unitPrice: price,
        quantity: item.quantity,
        totalPrice: totalItemPrice,
        thumbnailUrl: sku.imageUrl || sku.product.thumbnailUrl,
      };
    });

    const shippingFee = subtotal >= 500000 ? 0 : 30000;
    const discountAmount = 0;
    const totalAmount = subtotal + shippingFee - discountAmount;

    // Parse địa chỉ giao hàng
    let shippingAddressJson: OrderPrisma.Prisma.InputJsonValue = {};
    try {
      shippingAddressJson = JSON.parse(data.shipping_address_json || '{}') as OrderPrisma.Prisma.InputJsonObject;
    } catch {
      shippingAddressJson = { address: data.shipping_address_json };
    }

    // 4. Lưu đơn hàng vào PostgreSQL qua Transaction
    let orderCode = this.generateOrderCode();
    // Đảm bảo mã đơn duy nhất
    let codeExists = await this.prisma.order.findUnique({ where: { orderCode } });
    while (codeExists) {
      orderCode = this.generateOrderCode();
      codeExists = await this.prisma.order.findUnique({ where: { orderCode } });
    }

    const validPaymentMethods: Record<string, OrderPrisma.PaymentMethod> = {
      COD: OrderPrisma.PaymentMethod.COD,
      VNPAY: OrderPrisma.PaymentMethod.VNPAY,
      MOMO: OrderPrisma.PaymentMethod.MOMO,
      STRIPE: OrderPrisma.PaymentMethod.STRIPE,
    };
    const paymentMethod = validPaymentMethods[data.payment_method] || OrderPrisma.PaymentMethod.COD;
    const isCod = paymentMethod === OrderPrisma.PaymentMethod.COD;

    const initialOrderStatus = isCod
      ? OrderPrisma.OrderStatus.CONFIRMED
      : OrderPrisma.OrderStatus.PENDING;
    const initialPaymentStatus = OrderPrisma.PaymentStatus.PENDING;
    const reservationStatus = isCod
      ? OrderPrisma.ReservationStatus.COMMITTED
      : OrderPrisma.ReservationStatus.HOLD;
    const expiresAt = isCod ? null : new Date(Date.now() + 15 * 60 * 1000);
    const initialNote = isCod
      ? 'Đơn hàng COD được xác nhận tự động - Đã chốt giữ tồn kho'
      : 'Khách hàng đặt hàng thành công - Chờ thanh toán trực tuyến trong 15 phút';

    const order: OrderWithItems = await this.prisma.$transaction(async (tx): Promise<OrderWithItems> => {
      const createdOrder = await tx.order.create({
        data: {
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
          paymentStatus: initialPaymentStatus,
          orderStatus: initialOrderStatus,
          voucherCode: data.voucher_code || undefined,
          note: data.note || undefined,
          items: {
            create: orderItemsData,
          },
          statusHistory: {
            create: {
              fromStatus: 'NONE',
              toStatus: initialOrderStatus,
              note: initialNote,
              changedBy: data.customer_id || 'CUSTOMER',
            },
          },
        },
        include: {
          items: true,
        },
      });

      // Tạo bản ghi giữ hàng (SAGA Reservation)
      for (const item of data.items) {
        await tx.inventoryReservation.create({
          data: {
            orderId: createdOrder.id,
            skuId: item.sku_id,
            quantity: item.quantity,
            status: reservationStatus,
            expiresAt,
          },
        });
      }

      return createdOrder;
    });

    // Với đơn COD (xác nhận ngay), trừ cứng tồn kho vật lý trong PostgreSQL product_db
    if (isCod) {
      for (const item of data.items) {
        await this.productPrisma.productSku.update({
          where: { id: item.sku_id },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }
    }

    return {
      success: true,
      message: 'Đặt hàng thành công',
      order: this.mapOrderToDto(order),
    };
  }

  async getOrderById(data: GetOrderByIdRequest): Promise<GetOrderByIdResponse> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.order_id);
    let order: OrderWithItems | null = null;

    if (isUuid) {
      order = await this.prisma.order.findUnique({
        where: { id: data.order_id },
        include: { items: true },
      });
    }

    if (!order) {
      order = await this.prisma.order.findUnique({
        where: { orderCode: data.order_id },
        include: { items: true },
      });
    }

    if (!order) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Không tìm thấy đơn hàng',
      });
    }

    return {
      order: this.mapOrderToDto(order),
    };
  }

  async getOrdersByCustomer(data: GetOrdersByCustomerRequest): Promise<GetOrdersByCustomerResponse> {
    const page = Math.max(1, data.page || 1);
    const limit = Math.max(1, Math.min(50, data.limit || 10));
    const skip = (page - 1) * limit;

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where: { customerId: data.customer_id } }),
      this.prisma.order.findMany({
        where: { customerId: data.customer_id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
    ]);

    return {
      orders: orders.map((o) => this.mapOrderToDto(o)),
      total,
    };
  }

  async cancelOrder(data: CancelOrderRequest): Promise<CancelOrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: data.order_id },
      include: { items: true },
    });

    if (!order) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Không tìm thấy đơn hàng để hủy',
      });
    }

    if (order.orderStatus === 'CANCELLED') {
      return { success: true, message: 'Đơn hàng đã được hủy trước đó' };
    }

    if (order.orderStatus === 'SHIPPING' || order.orderStatus === 'DELIVERED') {
      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: 'Không thể hủy đơn hàng đang giao hoặc đã hoàn thành',
      });
    }

    // Cập nhật trạng thái trong PostgreSQL và giải phóng reservation nguyên tử
    const releasedCount = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          orderStatus: 'CANCELLED',
          cancelReason: data.reason || 'Khách hàng yêu cầu hủy',
          statusHistory: {
            create: {
              fromStatus: order.orderStatus,
              toStatus: 'CANCELLED',
              note: data.reason || 'Hủy đơn hàng',
              changedBy: data.customer_id || 'CUSTOMER',
            },
          },
        },
      });

      const res = await tx.inventoryReservation.updateMany({
        where: { orderId: order.id, status: OrderPrisma.ReservationStatus.HOLD },
        data: { status: OrderPrisma.ReservationStatus.RELEASED },
      });

      return res.count;
    });

    // Chỉ hoàn lại tồn kho trên Redis nếu reservation thực sự vừa được chuyển từ HOLD sang RELEASED
    if (releasedCount > 0) {
      for (const item of order.items) {
        await this.safeRestoreRedisStock(item.skuId, item.quantity);
      }
    }

    // Nếu đơn hàng đã từng được CONFIRMED (đã trừ kho vật lý), hoàn lại tồn kho trong PostgreSQL
    if (order.orderStatus === OrderPrisma.OrderStatus.CONFIRMED) {
      for (const item of order.items) {
        await this.productPrisma.productSku.update({
          where: { id: item.skuId },
          data: {
            stockQuantity: {
              increment: item.quantity,
            },
          },
        });
      }
    }

    return {
      success: true,
      message: 'Hủy đơn hàng thành công và đã nhả lại tồn kho',
    };
  }

  async processPaymentSuccess(data: ProcessPaymentSuccessRequest): Promise<ProcessPaymentSuccessResponse> {
    const order = await this.prisma.order.findUnique({
      where: { orderCode: data.order_code },
      include: { items: true },
    });

    if (!order) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Không tìm thấy đơn hàng mã: ${data.order_code}`,
      });
    }

    if (order.paymentStatus === OrderPrisma.PaymentStatus.PAID) {
      return {
        success: true,
        message: 'Đơn hàng đã được ghi nhận thanh toán thành công trước đó',
        order: this.mapOrderToDto(order),
      };
    }

    // SAGA Step: Chốt đơn hàng và chuyển trạng thái giữ kho sang COMMITTED vĩnh viễn
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: OrderPrisma.PaymentStatus.PAID,
          orderStatus: OrderPrisma.OrderStatus.CONFIRMED,
          statusHistory: {
            create: {
              fromStatus: order.orderStatus,
              toStatus: OrderPrisma.OrderStatus.CONFIRMED,
              note: `Thanh toán thành công qua ${data.payment_method || 'VNPAY'} (Mã GD: ${data.transaction_no})`,
              changedBy: 'PAYMENT_SERVICE',
            },
          },
        },
        include: { items: true },
      });

      await tx.inventoryReservation.updateMany({
        where: {
          orderId: order.id,
          status: OrderPrisma.ReservationStatus.HOLD,
        },
        data: {
          status: OrderPrisma.ReservationStatus.COMMITTED,
          expiresAt: null,
        },
      });

      return ord;
    });

    // SAGA: Thanh toán trực tuyến thành công -> trừ cứng tồn kho vật lý trong PostgreSQL product_db
    for (const item of order.items) {
      await this.productPrisma.productSku.update({
        where: { id: item.skuId },
        data: {
          stockQuantity: {
            decrement: item.quantity,
          },
        },
      });
    }

    return {
      success: true,
      message: 'Xác nhận thanh toán đơn hàng thành công',
      order: this.mapOrderToDto(updatedOrder),
    };
  }

  async processPaymentFailed(data: ProcessPaymentFailedRequest): Promise<ProcessPaymentFailedResponse> {
    const order = await this.prisma.order.findUnique({
      where: { orderCode: data.order_code },
      include: { items: true },
    });

    if (!order) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Không tìm thấy đơn hàng mã: ${data.order_code}`,
      });
    }

    if (order.orderStatus === OrderPrisma.OrderStatus.CANCELLED) {
      return {
        success: true,
        message: 'Đơn hàng đã ở trạng thái hủy trước đó',
      };
    }

    // 1. Cập nhật trạng thái đơn hàng CANCELLED và giải phóng Reservation RELEASED trong PostgreSQL
    const releasedCount = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: OrderPrisma.PaymentStatus.FAILED,
          orderStatus: OrderPrisma.OrderStatus.CANCELLED,
          cancelReason: data.reason || 'Thanh toán trực tuyến thất bại hoặc bị hủy bởi người dùng',
          statusHistory: {
            create: {
              fromStatus: order.orderStatus,
              toStatus: OrderPrisma.OrderStatus.CANCELLED,
              note: `Thanh toán thất bại: ${data.reason || 'Hủy giao dịch'} - Hệ thống đã nhả lại tồn kho`,
              changedBy: 'PAYMENT_SERVICE',
            },
          },
        },
      });

      const res = await tx.inventoryReservation.updateMany({
        where: { orderId: order.id, status: OrderPrisma.ReservationStatus.HOLD },
        data: { status: OrderPrisma.ReservationStatus.RELEASED },
      });

      return res.count;
    });

    // 2. SAGA Compensating: Chỉ nhả tồn kho Redis nếu reservation vừa được giải phóng từ HOLD -> RELEASED
    if (releasedCount > 0) {
      for (const item of order.items) {
        await this.safeRestoreRedisStock(item.skuId, item.quantity);
      }
    }

    return {
      success: true,
      message: 'Hủy đơn hàng và giải phóng giữ kho thành công',
    };
  }

  /**
   * Hoàn lại tồn kho trên Redis có chặn trần (Ceiling Guard)
   * Không bao giờ để Redis vượt quá tồn kho vật lý trong PostgreSQL
   */
  private async safeRestoreRedisStock(skuId: string, quantity: number): Promise<void> {
    try {
      const stockKey = `stock:${skuId}`;
      const sku = await this.productPrisma.productSku.findUnique({
        where: { id: skuId },
        select: { stockQuantity: true },
      });

      const maxStock = sku?.stockQuantity ?? 1000;
      const currentVal = await this.redis.get(stockKey);

      if (currentVal !== null && currentVal !== undefined) {
        const currentStock = Number(currentVal);
        const newStock = Math.min(currentStock + quantity, maxStock);
        await this.redis.set(stockKey, newStock);
      } else {
        await this.redis.set(stockKey, maxStock);
      }
    } catch (err: unknown) {
      console.error(`[safeRestoreRedisStock] Lỗi hoàn kho cho SKU ${skuId}:`, err);
    }
  }

  private mapOrderToDto(order: OrderWithItems): OrderDto {
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
    };
  }
}
