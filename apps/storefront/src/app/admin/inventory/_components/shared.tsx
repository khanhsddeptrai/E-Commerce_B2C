'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { InventoryTransactionType } from '@/types/ecommerce';

export type FeedbackHandler = (text: string, type: 'success' | 'error') => void;

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const TRANSACTION_TYPE_CONFIG: Record<InventoryTransactionType, { label: string; className: string }> = {
  INBOUND: { label: 'Nhập kho', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  OUTBOUND: { label: 'Xuất kho', className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  RETURN: { label: 'Hàng hoàn', className: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  ADJUSTMENT: { label: 'Điều chỉnh', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

export const formatPrice = (p: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

export const formatNumber = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

export const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/** created_by dạng "ADMIN_<email>" → chỉ hiển thị email */
export const formatActor = (createdBy: string) => createdBy.replace(/^ADMIN_/, '') || '—';

export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Gọi API theo requestKey (mã hóa đầy đủ tham số của fetcher): đổi key → tự gọi lại, bỏ kết quả của lượt gọi cũ.
 * isLoading được suy ra từ key của kết quả gần nhất nên không cần setState đồng bộ trong effect.
 */
export function useRemoteData<T>(requestKey: string, fetcher: () => Promise<T>, enabled = true) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ key: requestKey, data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ key: requestKey, error: err instanceof Error ? err.message : 'Lỗi tải dữ liệu' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestKey đã chứa mọi tham số của fetcher
  }, [requestKey, enabled]);

  const isCurrent = state.key === requestKey;
  return {
    data: isCurrent ? state.data : undefined,
    error: isCurrent ? state.error : undefined,
    isLoading: enabled && !isCurrent,
  };
}

interface PaginationBarProps {
  page: number;
  limit: number;
  total: number;
  unitLabel: string;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

/** Thanh phân trang chuẩn cho bảng quản trị: số dòng / trang, Trước / Sau / số trang, "Hiển thị X - Y trên tổng số Z" */
export function PaginationBar({ page, limit, total, unitLabel, onPageChange, onLimitChange }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-3 text-slate-400 flex-wrap justify-center">
        <span>
          Hiển thị <strong className="text-white">{from}</strong> - <strong className="text-white">{to}</strong> trên
          tổng số <strong className="text-white">{total}</strong> {unitLabel}
        </span>
        <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
          <span>Số dòng:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} / trang
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Trước
        </button>

        <div className="flex items-center gap-1 px-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const showEllipsis = prev !== undefined && p - prev > 1;
              return (
                <React.Fragment key={p}>
                  {showEllipsis && <span className="px-1 text-slate-600">...</span>}
                  <button
                    type="button"
                    onClick={() => onPageChange(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      page === p
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                </React.Fragment>
              );
            })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
        >
          Sau <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Dòng khung xương khi đang tải bảng */
export function SkeletonRows({ rows = 6, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-slate-800/60">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="py-3.5 px-4">
              <div className="h-3.5 rounded bg-slate-800/80 animate-pulse" style={{ width: `${50 + ((r + c) % 4) * 12}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ErrorRow({ cols, message, onRetry }: { cols: number; message: string; onRetry: () => void }) {
  return (
    <tr>
      <td colSpan={cols} className="py-16 text-center space-y-3">
        <p className="text-sm font-bold text-rose-300">Không tải được dữ liệu</p>
        <p className="text-xs text-slate-400">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer active:scale-95"
        >
          Thử lại
        </button>
      </td>
    </tr>
  );
}
