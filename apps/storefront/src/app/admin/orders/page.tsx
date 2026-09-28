'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Loader2,
  RefreshCw,
  Send,
  MapPin,
  AlertCircle,
  Boxes,
  Eye,
  Copy,
  Check,
  Ban,
  User,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  X,
  ChevronDown,
  CheckSquare,
  Square,
  MinusSquare,
  Filter,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { orderService } from '@/services/orderService';
import { ApiOrderDto } from '@/types/ecommerce';
import { Tooltip } from '@/components/Tooltip';

type StatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';
type PaymentMethodFilter = 'ALL' | 'COD' | 'VNPAY';
type PaymentStatusFilter = 'ALL' | 'PAID' | 'UNPAID';

const CARRIERS = [
  { id: 'GHN', name: 'Giao Hàng Nhanh (GHN)', prefix: 'GHN' },
  { id: 'GHTK', name: 'Giao Hàng Tiết Kiệm (GHTK)', prefix: 'GHTK' },
  { id: 'VIETTEL', name: 'Viettel Post', prefix: 'VTP' },
  { id: 'VNPOST', name: 'VNPost EMS', prefix: 'VNP' },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<ApiOrderDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('ALL');
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Bulk Actions Selection State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Slide-over Drawer: Chi tiết đơn hàng toàn diện
  const [detailDrawerOrder, setDetailDrawerOrder] = useState<ApiOrderDto | null>(null);

  // Modal 1: Bàn giao vận chuyển (CONFIRMED -> SHIPPING)
  const [shippingModalOrder, setShippingModalOrder] = useState<ApiOrderDto | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState(CARRIERS[0].name);
  const [customTrackingCode, setCustomTrackingCode] = useState('');
  const [transitLocation, setTransitLocation] = useState('Kho phân loại Tân Bình, TP. Hồ Chí Minh');
  const [shippingNote, setShippingNote] = useState('Đơn hàng đã được bàn giao cho đối tác vận chuyển');

  // Modal 2: Cập nhật vị trí trung chuyển (trong khi SHIPPING)
  const [locationModalOrder, setLocationModalOrder] = useState<ApiOrderDto | null>(null);
  const [newLocation, setNewLocation] = useState('');
  const [newLocationNote, setNewLocationNote] = useState('');

  // Modal 3: Hủy đơn hàng
  const [cancelModalOrder, setCancelModalOrder] = useState<ApiOrderDto | null>(null);
  const [cancelReason, setCancelReason] = useState('Khách hàng yêu cầu hủy qua hotline');

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await orderService.getAllOrdersForAdmin(1, 100);
      setOrders(res.orders || []);
    } catch (err: unknown) {
      console.error('Failed to fetch orders:', err);
      setFeedbackMessage({ text: 'Lỗi nạp danh sách đơn hàng', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Lắng nghe phím ESC để đóng Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detailDrawerOrder) {
        setDetailDrawerOrder(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailDrawerOrder]);

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleCopyTracking = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getTimelineEventConfig = (hist: { to_status: string; location?: string; note?: string }) => {
    switch (hist.to_status) {
      case 'DELIVERED':
        return {
          title: 'Giao hàng thành công',
          subtitle: hist.note || 'Kiện hàng đã được phát thành công và khách hàng đã nhận',
          dotColor: 'bg-emerald-400',
          dotRing: 'ring-emerald-400 bg-emerald-500/30',
          pingColor: 'bg-emerald-500/20',
          borderDot: 'border-emerald-400/80',
          badge: 'Giao thành công',
          badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        };
      case 'SHIPPING':
        if (hist.location && !hist.note?.includes('Bàn giao')) {
          return {
            title: `Trung chuyển qua ${hist.location}`,
            subtitle: hist.note || 'Kiện hàng đang được luân chuyển giữa các trung tâm phân loại',
            dotColor: 'bg-sky-400',
            dotRing: 'ring-sky-400 bg-sky-500/30',
            pingColor: 'bg-sky-500/20',
            borderDot: 'border-sky-400/80',
            badge: 'Bưu cục trung chuyển',
            badgeClass: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
          };
        }
        return {
          title: 'Đang vận chuyển giao hàng',
          subtitle: hist.note || 'Đơn hàng đã xuất kho và bàn giao cho đối tác vận chuyển',
          dotColor: 'bg-indigo-400',
          dotRing: 'ring-indigo-400 bg-indigo-500/30',
          pingColor: 'bg-indigo-500/20',
          borderDot: 'border-indigo-400/80',
          badge: 'Đang vận chuyển',
          badgeClass: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
        };
      case 'CONFIRMED':
        return {
          title: 'Đã xác nhận & Đang đóng gói',
          subtitle: hist.note || 'Đơn hàng đã được duyệt, bộ phận kho đang xử lý và chuẩn bị kiện hàng',
          dotColor: 'bg-blue-400',
          dotRing: 'ring-blue-400 bg-blue-500/30',
          pingColor: 'bg-blue-500/20',
          borderDot: 'border-blue-400/80',
          badge: 'Đã xác nhận',
          badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
        };
      case 'CANCELLED':
        return {
          title: 'Đơn hàng đã bị hủy',
          subtitle: hist.note || 'Đơn hàng đã kết thúc và tiến hành giải phóng tồn kho SAGA',
          dotColor: 'bg-rose-400',
          dotRing: 'ring-rose-400 bg-rose-500/30',
          pingColor: 'bg-rose-500/20',
          borderDot: 'border-rose-400/80',
          badge: 'Đã hủy đơn',
          badgeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        };
      default:
        return {
          title: 'Khởi tạo đơn hàng',
          subtitle: hist.note || 'Đơn hàng được ghi nhận thành công vào hệ thống',
          dotColor: 'bg-amber-400',
          dotRing: 'ring-amber-400 bg-amber-500/30',
          pingColor: 'bg-amber-500/20',
          borderDot: 'border-amber-400/80',
          badge: 'Chờ xác nhận',
          badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        };
    }
  };

  // Lọc danh sách theo Tab, Search Box, và Bộ lọc nâng cao
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = statusFilter === 'ALL' || o.order_status === statusFilter;
      const matchPaymentMethod = paymentMethodFilter === 'ALL' || o.payment_method === paymentMethodFilter;
      const matchPaymentStatus = paymentStatusFilter === 'ALL' || o.payment_status === paymentStatusFilter;

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        o.order_code.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q) ||
        (o.tracking_code && o.tracking_code.toLowerCase().includes(q));

      return matchStatus && matchPaymentMethod && matchPaymentStatus && matchSearch;
    });
  }, [orders, statusFilter, paymentMethodFilter, paymentStatusFilter, searchQuery]);

  // Thống kê số lượng theo từng Tab
  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter((o) => o.order_status === 'PENDING').length,
      confirmed: orders.filter((o) => o.order_status === 'CONFIRMED').length,
      shipping: orders.filter((o) => o.order_status === 'SHIPPING').length,
      delivered: orders.filter((o) => o.order_status === 'DELIVERED').length,
      cancelled: orders.filter((o) => o.order_status === 'CANCELLED').length,
    };
  }, [orders]);

  // Checkbox Selection Logic
  const allFilteredSelected =
    filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.includes(o.id));
  const someFilteredSelected =
    filteredOrders.some((o) => selectedOrderIds.includes(o.id)) && !allFilteredSelected;

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      // Bỏ chọn tất cả các đơn thuộc danh sách lọc hiện tại
      setSelectedOrderIds((prev) => prev.filter((id) => !filteredOrders.some((o) => o.id === id)));
    } else {
      // Chọn tất cả các đơn thuộc danh sách lọc hiện tại
      const newIds = new Set([...selectedOrderIds, ...filteredOrders.map((o) => o.id)]);
      setSelectedOrderIds(Array.from(newIds));
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Đếm số đơn PENDING trong tập đã chọn (phục vụ Bulk Confirm)
  const pendingCountInSelection = useMemo(() => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
    return selectedOrders.filter((o) => o.order_status === 'PENDING').length;
  }, [orders, selectedOrderIds]);

  // 1. Hành động: Xác nhận đơn hàng (PENDING -> CONFIRMED)
  const handleConfirmOrder = async (order: ApiOrderDto) => {
    setProcessingOrderId(order.id);
    try {
      const res = await orderService.updateDeliveryStatus(order.id, {
        new_status: 'CONFIRMED',
        location: 'Kho tổng Novatech Logistics',
        note: 'Người bán đã xác nhận đơn hàng và chuẩn bị xuất kho',
        changed_by: 'ADMIN_OPERATOR',
      });
      if (res.success) {
        setFeedbackMessage({ text: `Đã xác nhận đơn hàng [${order.order_code}]`, type: 'success' });
        await fetchOrders();
        // Cập nhật lại Drawer nếu đang xem đơn này
        if (detailDrawerOrder?.id === order.id) {
          setDetailDrawerOrder((prev) => (prev ? { ...prev, order_status: 'CONFIRMED' } : null));
        }
      } else {
        setFeedbackMessage({ text: res.message || 'Xác nhận thất bại', type: 'error' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
      setFeedbackMessage({ text: msg, type: 'error' });
    } finally {
      setProcessingOrderId(null);
    }
  };

  // 1.1 Thao tác hàng loạt: Xác nhận tất cả các đơn PENDING đã chọn
  const handleBulkConfirm = async () => {
    const pendingOrders = orders.filter(
      (o) => selectedOrderIds.includes(o.id) && o.order_status === 'PENDING'
    );
    if (pendingOrders.length === 0) return;

    setIsBulkProcessing(true);
    let successCount = 0;
    try {
      for (const order of pendingOrders) {
        try {
          const res = await orderService.updateDeliveryStatus(order.id, {
            new_status: 'CONFIRMED',
            location: 'Kho tổng Novatech Logistics',
            note: 'Duyệt đơn hàng loạt bởi Quản trị viên',
            changed_by: 'ADMIN_BATCH_OPS',
          });
          if (res.success) successCount++;
        } catch {
          // Bỏ qua lỗi từng đơn lẻ
        }
      }
      setFeedbackMessage({
        text: `Đã duyệt thành công ${successCount}/${pendingOrders.length} đơn hàng chờ xử lý`,
        type: 'success',
      });
      setSelectedOrderIds([]);
      await fetchOrders();
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // 2. Mở modal bàn giao vận chuyển (CONFIRMED -> SHIPPING)
  const openShippingModal = (order: ApiOrderDto) => {
    const carrier = CARRIERS[0];
    const generatedTracking = `${carrier.prefix}${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`;
    setShippingModalOrder(order);
    setSelectedCarrier(carrier.name);
    setCustomTrackingCode(generatedTracking);
    setTransitLocation('Kho phân loại Tân Bình, TP. Hồ Chí Minh');
    setShippingNote('Đơn hàng đã được bàn giao cho đối tác vận chuyển');
  };

  const handleConfirmShipping = async () => {
    if (!shippingModalOrder) return;
    setProcessingOrderId(shippingModalOrder.id);
    try {
      const res = await orderService.updateDeliveryStatus(shippingModalOrder.id, {
        new_status: 'SHIPPING',
        carrier_name: selectedCarrier,
        tracking_code: customTrackingCode,
        location: transitLocation,
        note: shippingNote,
        changed_by: 'LOGISTICS_DISPATCHER',
      });
      if (res.success) {
        setFeedbackMessage({
          text: `Đơn hàng [${shippingModalOrder.order_code}] đã xuất kho bàn giao ${selectedCarrier}`,
          type: 'success',
        });
        const updatedId = shippingModalOrder.id;
        setShippingModalOrder(null);
        await fetchOrders();
        if (detailDrawerOrder?.id === updatedId) {
          setDetailDrawerOrder((prev) =>
            prev
              ? {
                  ...prev,
                  order_status: 'SHIPPING',
                  carrier_name: selectedCarrier,
                  tracking_code: customTrackingCode,
                }
              : null
          );
        }
      } else {
        setFeedbackMessage({ text: res.message || 'Cập nhật thất bại', type: 'error' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
      setFeedbackMessage({ text: msg, type: 'error' });
    } finally {
      setProcessingOrderId(null);
    }
  };

  // 3. Hành động: Đánh dấu giao thành công (SHIPPING -> DELIVERED)
  const handleDelivered = async (order: ApiOrderDto) => {
    setProcessingOrderId(order.id);
    try {
      const res = await orderService.updateDeliveryStatus(order.id, {
        new_status: 'DELIVERED',
        location: 'Địa chỉ người nhận',
        note: 'Giao hàng thành công. Khách hàng đã nhận và ký biên nhận kiện hàng',
        changed_by: 'SHIPPER_MOBILE_APP',
      });
      if (res.success) {
        setFeedbackMessage({
          text: `Đơn hàng [${order.order_code}] đã giao thành công (Tự động thu COD sang Đã Thanh Toán)`,
          type: 'success',
        });
        await fetchOrders();
        if (detailDrawerOrder?.id === order.id) {
          setDetailDrawerOrder((prev) =>
            prev ? { ...prev, order_status: 'DELIVERED', payment_status: 'PAID' } : null
          );
        }
      } else {
        setFeedbackMessage({ text: res.message || 'Cập nhật thất bại', type: 'error' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
      setFeedbackMessage({ text: msg, type: 'error' });
    } finally {
      setProcessingOrderId(null);
    }
  };

  // 4. Hành động: Cập nhật vị trí trung chuyển (Trong khi đang SHIPPING)
  const handleUpdateTransitLocation = async () => {
    if (!locationModalOrder) return;
    setProcessingOrderId(locationModalOrder.id);
    try {
      const res = await orderService.updateDeliveryStatus(locationModalOrder.id, {
        new_status: 'SHIPPING',
        location: newLocation || 'Kho trung chuyển',
        note: newLocationNote || 'Kiện hàng đã qua bưu cục trung chuyển',
        changed_by: 'CARRIER_HUB_SCAN',
      });
      if (res.success) {
        setFeedbackMessage({
          text: `Đã cập nhật vị trí mới cho đơn hàng [${locationModalOrder.order_code}]`,
          type: 'success',
        });
        setLocationModalOrder(null);
        await fetchOrders();
      } else {
        setFeedbackMessage({ text: res.message || 'Cập nhật thất bại', type: 'error' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
      setFeedbackMessage({ text: msg, type: 'error' });
    } finally {
      setProcessingOrderId(null);
    }
  };

  // 5. Hành động: Hủy đơn hàng (PENDING hoặc CONFIRMED)
  const handleCancelOrder = async () => {
    if (!cancelModalOrder) return;
    setProcessingOrderId(cancelModalOrder.id);
    try {
      const res = await orderService.updateDeliveryStatus(cancelModalOrder.id, {
        new_status: 'CANCELLED',
        note: cancelReason,
        location: 'Trung tâm xử lý hoàn trả hàng',
        changed_by: 'ADMIN_OPERATOR',
      });
      if (res.success) {
        setFeedbackMessage({
          text: `Đã hủy đơn hàng [${cancelModalOrder.order_code}] (SAGA đã hoàn trả kho hàng)`,
          type: 'success',
        });
        const updatedId = cancelModalOrder.id;
        setCancelModalOrder(null);
        await fetchOrders();
        if (detailDrawerOrder?.id === updatedId) {
          setDetailDrawerOrder((prev) => (prev ? { ...prev, order_status: 'CANCELLED' } : null));
        }
      } else {
        setFeedbackMessage({ text: res.message || 'Hủy thất bại', type: 'error' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
      setFeedbackMessage({ text: msg, type: 'error' });
    } finally {
      setProcessingOrderId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-[1680px] mx-auto pb-20">
      {/* Page Title */}
      <div className="pt-1">
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Quản Lý Đơn Hàng
        </h1>
      </div>

      {/* Feedback Toast Notification */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 shadow-lg shadow-emerald-950/30'
              : 'bg-rose-950/60 text-rose-300 border border-rose-800/80 shadow-lg shadow-rose-950/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filter and Control Bar (Tabs + Search + Dropdown Filters) */}
      <div className="bg-[#0F172A]/90 rounded-2xl p-3.5 border border-slate-800/80 space-y-3">
        {/* Row 1: Status Tabs (Left) + Refresh Button (Right) */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
            {(
              [
                { id: 'ALL', label: 'Tất cả đơn', count: stats.total },
                { id: 'PENDING', label: 'Chờ xác nhận', count: stats.pending, alert: stats.pending > 0 },
                { id: 'CONFIRMED', label: 'Đã xác nhận', count: stats.confirmed },
                { id: 'SHIPPING', label: 'Đang vận chuyển', count: stats.shipping },
                { id: 'DELIVERED', label: 'Giao thành công', count: stats.delivered },
                { id: 'CANCELLED', label: 'Đã hủy', count: stats.cancelled },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-bold'
                    : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800/50'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    statusFilter === tab.id
                      ? 'bg-indigo-800 text-indigo-100'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Nút Làm mới bên phải các trạng thái */}
          <button
            type="button"
            onClick={fetchOrders}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 shadow-xs disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Row 2: Search input + Secondary Filters */}
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between pt-1 border-t border-slate-800/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm theo mã đơn, khách hàng, số điện thoại, vận đơn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Lọc phương thức thanh toán */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">Hình thức:</span>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value as PaymentMethodFilter)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">Tất cả</option>
                <option value="COD" className="bg-slate-900 text-white">COD (Tiền mặt)</option>
                <option value="VNPAY" className="bg-slate-900 text-white">VNPAY</option>
              </select>
            </div>

            {/* Lọc tình trạng thanh toán */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">Thanh toán:</span>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value as PaymentStatusFilter)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">Tất cả</option>
                <option value="PAID" className="bg-slate-900 text-white">Đã Thanh Toán</option>
                <option value="UNPAID" className="bg-slate-900 text-white">Chưa Thanh Toán</option>
              </select>
            </div>

            {(paymentMethodFilter !== 'ALL' || paymentStatusFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setPaymentMethodFilter('ALL');
                  setPaymentStatusFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 transition-colors"
              >
                Đặt lại
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-[#0F172A]/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-xs font-semibold text-slate-400">Đang đồng bộ danh sách đơn hàng...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-700 mx-auto" />
            <h3 className="text-sm font-bold text-white">Không tìm thấy đơn hàng nào</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Không có đơn hàng nào khớp với tiêu chí tìm kiếm hoặc bộ lọc hiện tại.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/70 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      title={allFilteredSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả đơn'}
                      className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : someFilteredSelected ? (
                        <MinusSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3">Mã Đơn & Thời Gian</th>
                  <th className="py-3 px-3">Khách Hàng</th>
                  <th className="py-3 px-3">Sản Phẩm</th>
                  <th className="py-3 px-3">Giá Trị & Thanh Toán</th>
                  <th className="py-3 px-3">Vận Chuyển / Tracking</th>
                  <th className="py-3 px-3">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map((order) => {
                  const isProcessing = processingOrderId === order.id;
                  const isSelected = selectedOrderIds.includes(order.id);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setDetailDrawerOrder(order)}
                      className={`cursor-pointer transition-colors group/row ${
                        isSelected
                          ? 'bg-indigo-950/20 hover:bg-indigo-950/30'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td
                        className="py-3.5 px-3 text-center align-top"
                        onClick={(e) => handleToggleSelectRow(order.id, e)}
                      >
                        <button
                          type="button"
                          className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 group-hover/row:text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* 1. Mã đơn & Thời gian */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-indigo-400 text-xs">
                            {order.order_code}
                          </span>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{formatDate(order.created_at)}</span>
                          </p>
                        </div>
                      </td>

                      {/* 2. Khách hàng */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="space-y-0.5">
                          <p className="font-bold text-white text-xs">{order.customer_name}</p>
                          <p className="text-slate-400 text-[11px] font-mono">{order.customer_phone}</p>
                          <p className="text-slate-500 text-[10px] truncate max-w-[160px]">{order.customer_email}</p>
                        </div>
                      </td>

                      {/* 3. Sản phẩm */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/60">
                            <Boxes className="w-3 h-3 text-indigo-400 shrink-0" />
                            {order.items?.length || 0} mặt hàng
                          </span>
                          {order.items && order.items.length > 0 && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[190px]" title={order.items[0].product_name}>
                              {order.items[0].product_name}
                              {order.items.length > 1 && ` (+${order.items.length - 1} khác)`}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* 4. Tổng tiền & Thanh toán */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="space-y-1">
                          <p className="font-bold text-white text-xs">{formatPrice(order.total_amount)}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                              {order.payment_method}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                order.payment_status === 'PAID'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {order.payment_status === 'PAID' ? 'Đã Thanh Toán' : 'Chưa Thanh Toán'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 5. Vận chuyển / Tracking */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="space-y-1 max-w-[200px]">
                          <p className="font-medium text-slate-300 truncate">
                            {order.carrier_name || <span className="text-slate-500 italic">Chưa chỉ định</span>}
                          </p>
                          {order.tracking_code ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-indigo-400 font-bold text-[11px]">
                                {order.tracking_code}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyTracking(order.tracking_code!);
                                }}
                                title="Sao chép mã tracking"
                                className="text-slate-400 hover:text-white p-0.5"
                              >
                                {copiedCode === order.tracking_code ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : null}
                          {order.shipped_at && (
                            <p className="text-[10px] text-slate-500">
                              Xuất: {formatDate(order.shipped_at)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* 6. Trạng thái 4 bước */}
                      <td className="py-3.5 px-3 align-top">
                        <div>
                          {order.order_status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              1. Chờ duyệt
                            </span>
                          )}
                          {order.order_status === 'CONFIRMED' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <CheckCircle2 className="w-3 h-3 text-blue-400" />
                              2. Đã xác nhận
                            </span>
                          )}
                          {order.order_status === 'SHIPPING' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              <Truck className="w-3 h-3 animate-pulse text-indigo-400" />
                              3. Đang giao
                            </span>
                          )}
                          {order.order_status === 'DELIVERED' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              4. Hoàn tất
                            </span>
                          )}
                          {order.order_status === 'CANCELLED' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              Đã hủy
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Cột Thao Tác: Hiển thị đầy đủ nút bấm với icon tương ứng */}
                      <td
                        className="py-3.5 px-4 align-top text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Xem chi tiết (luôn có) */}
                          <Tooltip content="Xem chi tiết đơn hàng">
                            <button
                              type="button"
                              onClick={() => setDetailDrawerOrder(order)}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700/60 shadow-xs cursor-pointer active:scale-95"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-300" />
                            </button>
                          </Tooltip>

                          {/* THAO TÁC THEO TRẠNG THÁI (ICON-ONLY KÈM CUSTOM TOP TOOLTIP) */}
                          {order.order_status === 'PENDING' && (
                            <>
                              <Tooltip content="Duyệt đơn hàng">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmOrder(order)}
                                  disabled={isProcessing}
                                  className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                                >
                                  {isProcessing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </Tooltip>

                              <Tooltip content="Hủy đơn hàng">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelModalOrder(order);
                                    setCancelReason('Hủy đơn theo yêu cầu của khách hàng');
                                  }}
                                  disabled={isProcessing}
                                  className="p-2 rounded-lg border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                            </>
                          )}

                          {order.order_status === 'CONFIRMED' && (
                            <>
                              <Tooltip content="Xuất kho giao Shipper">
                                <button
                                  type="button"
                                  onClick={() => openShippingModal(order)}
                                  disabled={isProcessing}
                                  className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                                >
                                  {isProcessing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Truck className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </Tooltip>

                              <Tooltip content="Hủy đơn hàng">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelModalOrder(order);
                                    setCancelReason('Hủy đơn trước khi xuất kho');
                                  }}
                                  disabled={isProcessing}
                                  className="p-2 rounded-lg border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                            </>
                          )}

                          {order.order_status === 'SHIPPING' && (
                            <>
                              <Tooltip content="Quét trạm trung chuyển">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLocationModalOrder(order);
                                    setNewLocation('Bưu cục phát quận trung tâm');
                                    setNewLocationNote(
                                      'Kiện hàng đã tới bưu cục phát, shipper đang chuẩn bị giao'
                                    );
                                  }}
                                  disabled={isProcessing}
                                  className="p-2 rounded-lg border border-sky-500/30 hover:bg-sky-500/10 text-sky-300 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>

                              <Tooltip content="Xác nhận giao thành công">
                                <button
                                  type="button"
                                  onClick={() => handleDelivered(order)}
                                  disabled={isProcessing}
                                  className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                                >
                                  {isProcessing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* FLOATING BULK ACTIONS BAR (KHI CÓ ĐƠN ĐƯỢC CHỌN)               */}
      {/* ============================================================== */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/60 px-5 py-3 flex items-center gap-4 text-xs animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px]">
              {selectedOrderIds.length}
            </span>
            <span className="font-semibold text-slate-200">đơn đã chọn</span>
          </div>

          <div className="h-4 w-[1px] bg-slate-700" />

          <div className="flex items-center gap-2">
            {pendingCountInSelection > 0 && (
              <button
                type="button"
                onClick={handleBulkConfirm}
                disabled={isBulkProcessing}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/25 disabled:opacity-50"
              >
                {isBulkProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Duyệt {pendingCountInSelection} đơn chờ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SLIDE-OVER DRAWER: CHI TIẾT TOÀN DIỆN ĐƠN HÀNG (ENTERPRISE)     */}
      {/* ============================================================== */}
      {detailDrawerOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop mờ */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setDetailDrawerOrder(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-[#0F172A] border-l border-slate-800 shadow-2xl flex flex-col text-white animate-in slide-in-from-right duration-250">
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base font-black text-indigo-400">
                      {detailDrawerOrder.order_code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyTracking(detailDrawerOrder.order_code)}
                      title="Sao chép mã đơn"
                      className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
                    >
                      {copiedCode === detailDrawerOrder.order_code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    Đặt lúc: {formatDate(detailDrawerOrder.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailDrawerOrder(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 scrollbar-thin">
                {/* Khách hàng & Địa chỉ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Thông Tin Người Nhận
                    </p>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" /> {detailDrawerOrder.customer_name}
                    </p>
                    <p className="text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" /> {detailDrawerOrder.customer_phone}
                    </p>
                    <p className="text-slate-400 flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-500" /> {detailDrawerOrder.customer_email}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Địa Chỉ Giao Hàng
                    </p>
                    <p className="text-slate-200 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                      <span>
                        {(() => {
                          try {
                            const parsed = JSON.parse(detailDrawerOrder.shipping_address_json);
                            return parsed.fullAddress || parsed.address || detailDrawerOrder.shipping_address_json;
                          } catch {
                            return detailDrawerOrder.shipping_address_json;
                          }
                        })()}
                      </span>
                    </p>
                    {detailDrawerOrder.note && (
                      <p className="text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80">
                        <span className="font-semibold text-slate-300">Ghi chú:</span> {detailDrawerOrder.note}
                      </p>
                    )}
                  </div>
                </div>

                {/* Danh sách mặt hàng */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-indigo-400" />
                      <span>Danh Sách Sản Phẩm ({detailDrawerOrder.items?.length || 0})</span>
                    </p>
                  </div>

                  <div className="divide-y divide-slate-800/80 bg-slate-950/60 rounded-2xl border border-slate-800/80 p-3.5">
                    {detailDrawerOrder.items?.map((item) => (
                      <div
                        key={item.id}
                        className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{item.product_name}</p>
                          <p className="text-[11px] text-slate-400">Biến thể: {item.sku_name}</p>
                          <p className="text-[11px] text-slate-500">
                            {formatPrice(item.unit_price)} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-bold text-indigo-400 shrink-0">{formatPrice(item.total_price)}</p>
                      </div>
                    ))}

                    <div className="pt-3.5 border-t border-slate-800 flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-400">Tổng Thanh Toán:</span>
                      <span className="text-sm font-black text-indigo-400">
                        {formatPrice(detailDrawerOrder.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Thông tin đối tác vận chuyển & Tracking Code */}
                {(detailDrawerOrder.carrier_name || detailDrawerOrder.tracking_code) && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/40 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                          Đơn Vị Vận Chuyển
                        </span>
                        <span className="font-bold text-white text-xs sm:text-sm">
                          {detailDrawerOrder.carrier_name || 'Chưa chỉ định'}
                        </span>
                      </div>
                    </div>

                    {detailDrawerOrder.tracking_code && (
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                            Mã Vận Đơn
                          </span>
                          <span className="font-mono text-xs sm:text-sm font-bold text-indigo-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                            {detailDrawerOrder.tracking_code}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (detailDrawerOrder.tracking_code) {
                              handleCopyTracking(detailDrawerOrder.tracking_code);
                            }
                          }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors shadow-sm mt-3"
                          title="Sao chép mã vận đơn"
                        >
                          {copiedCode === detailDrawerOrder.tracking_code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Nhật Ký Hành Trình Vận Chuyển (Timeline dọc chuẩn xác) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <span>Nhật Ký Hành Trình Vận Chuyển</span>
                    </p>
                    {detailDrawerOrder.status_history && detailDrawerOrder.status_history.length > 0 && (
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700/60 font-mono">
                        {detailDrawerOrder.status_history.length} mốc
                      </span>
                    )}
                  </div>

                  {detailDrawerOrder.status_history && detailDrawerOrder.status_history.length > 0 ? (
                    <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800/80">
                      <div className="space-y-6">
                        {(() => {
                          const historyList = [...detailDrawerOrder.status_history].sort(
                            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                          );

                          return historyList.map((hist, idx) => {
                            const isLatest = idx === historyList.length - 1;
                            const isLast = idx === historyList.length - 1;
                            const cfg = getTimelineEventConfig(hist);

                            return (
                              <div key={hist.id || idx} className="relative flex items-start gap-3.5 group">
                                {/* Đường kẻ dọc kết nối liền mạch 100% không đứt đoạn */}
                                {!isLast && (
                                  <div className="absolute left-[11px] top-2 -bottom-[40px] w-[2px] bg-slate-700 z-0" />
                                )}

                                {/* Chấm tròn mốc thời gian căn giữa đường line (w-6 center = 12px, line left-11 w-2 center = 12px) */}
                                <div className="w-6 h-6 flex items-center justify-center shrink-0 relative z-10 mt-1">
                                  {isLatest ? (
                                    <div className="relative flex items-center justify-center w-6 h-6">
                                      <span className={`absolute w-5 h-5 rounded-full ${cfg.pingColor} animate-ping`} />
                                      <span className={`w-4 h-4 rounded-full ${cfg.dotRing} flex items-center justify-center ring-2`}>
                                        <span className={`w-2 h-2 rounded-full ${cfg.dotColor} shadow-xs`} />
                                      </span>
                                    </div>
                                  ) : (
                                    <span className={`w-3 h-3 rounded-full bg-slate-950 border-2 ${cfg.borderDot} shadow-xs`} />
                                  )}
                                </div>

                                {/* Thẻ nội dung mốc thời gian */}
                                <div
                                  className={`flex-1 min-w-0 p-3.5 rounded-xl border transition-all ${
                                    isLatest
                                      ? 'bg-slate-900/90 border-indigo-500/40 shadow-md shadow-indigo-950/30 ring-1 ring-indigo-500/20'
                                      : 'bg-slate-900/40 border-slate-800/70 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-xs font-bold ${isLatest ? 'text-white' : 'text-slate-200'}`}>
                                        {cfg.title}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badgeClass}`}>
                                        {cfg.badge}
                                      </span>
                                      {isLatest && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                          Hiện tại
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 shrink-0">
                                      <Calendar className="w-3 h-3 text-slate-500" />
                                      {formatDate(hist.created_at)}
                                    </span>
                                  </div>

                                  <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{cfg.subtitle}</p>

                                  {hist.location && (
                                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center gap-2 text-xs">
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/90 text-sky-300 border border-slate-800 text-[11px] font-medium">
                                        <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                        <span>{hist.location}</span>
                                      </span>
                                    </div>
                                  )}

                                  {hist.changed_by && (
                                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                                      <span>Ghi nhận:</span>
                                      <span className="font-medium text-slate-400">{hist.changed_by}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-950/50 rounded-2xl border border-slate-800/80 text-slate-500 space-y-1">
                      <Clock className="w-6 h-6 mx-auto text-slate-600" />
                      <p className="text-xs italic">Chưa có nhật ký hành trình ghi nhận cho đơn hàng này</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDetailDrawerOrder(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Đóng
                </button>

                <div className="flex items-center gap-2">
                  {detailDrawerOrder.order_status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => handleConfirmOrder(detailDrawerOrder)}
                      disabled={processingOrderId === detailDrawerOrder.id}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 disabled:opacity-50"
                    >
                      {processingOrderId === detailDrawerOrder.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Xác nhận đơn ngay</span>
                    </button>
                  )}

                  {detailDrawerOrder.order_status === 'CONFIRMED' && (
                    <button
                      type="button"
                      onClick={() => openShippingModal(detailDrawerOrder)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Xuất kho bàn giao</span>
                    </button>
                  )}

                  {detailDrawerOrder.order_status === 'SHIPPING' && (
                    <button
                      type="button"
                      onClick={() => handleDelivered(detailDrawerOrder)}
                      disabled={processingOrderId === detailDrawerOrder.id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-50"
                    >
                      {processingOrderId === detailDrawerOrder.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Giao thành công</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: BÀN GIAO VẬN CHUYỂN & XUẤT KHO (Step 3)              */}
      {/* ============================================================== */}
      {shippingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#0F172A] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-800 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Bàn Giao Shipper Xuất Kho</h3>
              </div>
              <button
                type="button"
                onClick={() => setShippingModalOrder(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Đơn hàng: <span className="font-mono font-bold text-indigo-400">{shippingModalOrder.order_code}</span> • Khách hàng:{' '}
              <span className="font-bold text-white">{shippingModalOrder.customer_name}</span>
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Đối Tác Vận Chuyển</label>
                <select
                  value={selectedCarrier}
                  onChange={(e) => {
                    const c = CARRIERS.find((x) => x.name === e.target.value) || CARRIERS[0];
                    setSelectedCarrier(c.name);
                    setCustomTrackingCode(`${c.prefix}${Date.now().toString().slice(-8)}${Math.floor(1000 + Math.random() * 9000)}`);
                  }}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500/30"
                >
                  {CARRIERS.map((c) => (
                    <option key={c.id} value={c.name} className="bg-slate-900 text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Mã Vận Đơn (Tracking Code)</label>
                <input
                  type="text"
                  value={customTrackingCode}
                  onChange={(e) => setCustomTrackingCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-indigo-400 font-bold focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Vị Trí Bưu Cục Xuất Phát</label>
                <input
                  type="text"
                  value={transitLocation}
                  onChange={(e) => setTransitLocation(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Ghi Chú Nhật Ký</label>
                <input
                  type="text"
                  value={shippingNote}
                  onChange={(e) => setShippingNote(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShippingModalOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 text-xs font-semibold hover:bg-slate-800 hover:text-white"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmShipping}
                disabled={processingOrderId === shippingModalOrder.id}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
              >
                {processingOrderId === shippingModalOrder.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Xác Nhận Xuất Kho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: QUÉT BƯU CỤC TRUNG CHUYỂN MỚI                         */}
      {/* ============================================================== */}
      {locationModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#0F172A] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-800 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Quét Bưu Cục Trung Chuyển Mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setLocationModalOrder(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Đơn hàng: <span className="font-mono font-bold text-indigo-400">{locationModalOrder.order_code}</span> • Đơn vị:{' '}
              <span className="font-bold text-white">{locationModalOrder.carrier_name}</span>
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Vị Trí / Bưu Cục Mới Quét</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Kho trung chuyển Cần Thơ SOC..."
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Ghi Chú Nhật Ký Hành Trình</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Kiện hàng đã nhập kho trung chuyển phân loại..."
                  value={newLocationNote}
                  onChange={(e) => setNewLocationNote(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setLocationModalOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 text-xs font-semibold hover:bg-slate-800 hover:text-white"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleUpdateTransitLocation}
                disabled={processingOrderId === locationModalOrder.id}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
              >
                {processingOrderId === locationModalOrder.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                Lưu Vị Trí Mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: HỦY ĐƠN HÀNG (SAGA SẼ HOÀN KHO)                       */}
      {/* ============================================================== */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#0F172A] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-rose-900/40 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <Ban className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Xác Nhận Hủy Đơn Hàng</h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-300">
              <p>
                Bạn có chắc chắn muốn hủy đơn hàng mã{' '}
                <span className="font-mono font-bold text-rose-400">{cancelModalOrder.order_code}</span>?
              </p>
              <p className="text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-[11px]">
                Toàn bộ số lượng tồn kho đã giữ (Reservation) sẽ được tự động giải phóng và trả lại kho hàng qua cơ chế SAGA bù trừ.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-300 block">Lý do hủy đơn</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-rose-500/30"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 text-xs font-semibold hover:bg-slate-800 hover:text-white"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={processingOrderId === cancelModalOrder.id}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 flex items-center gap-2 disabled:opacity-50"
              >
                {processingOrderId === cancelModalOrder.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                Xác Nhận Hủy Đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
