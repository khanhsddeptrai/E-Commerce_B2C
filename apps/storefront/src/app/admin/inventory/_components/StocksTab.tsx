'use client';

import React, { useState } from 'react';
import { Search, X, RefreshCw, SlidersHorizontal, History, Loader2, ShieldAlert, Boxes } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import { ApiInventoryStockItemDto } from '@/types/ecommerce';
import { Tooltip } from '@/components/Tooltip';
import { ResizableDrawer } from '@/components/ResizableDrawer';
import {
  ErrorRow,
  FeedbackHandler,
  PaginationBar,
  SkeletonRows,
  formatNumber,
  useDebouncedValue,
  useRemoteData,
} from './shared';

const LOW_STOCK_THRESHOLD = 5;
const ADJUST_REASONS = ['Kiểm kê định kỳ', 'Hàng hỏng / lỗi', 'Thất lạc', 'Nhập lại hàng tìm thấy'];
const COLS = 8;

interface StocksTabProps {
  onFeedback: FeedbackHandler;
  onViewLedger: (stock: ApiInventoryStockItemDto) => void;
}

export function StocksTab({ onFeedback, onViewLedger }: StocksTabProps) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const query = {
    page,
    limit,
    search: debouncedSearch || undefined,
    low_stock_only: lowStockOnly,
    low_stock_threshold: lowStockOnly ? LOW_STOCK_THRESHOLD : undefined,
  };
  const { data, error: loadError, isLoading } = useRemoteData(`${JSON.stringify(query)}#${reloadKey}`, () =>
    inventoryService.getStocks(query)
  );
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  // Drawer điều chỉnh kiểm kê
  const [adjustTarget, setAdjustTarget] = useState<ApiInventoryStockItemDto | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Modal đối soát Redis
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  const reload = () => setReloadKey((k) => k + 1);
  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const changeLowStockOnly = (value: boolean) => {
    setLowStockOnly(value);
    setPage(1);
  };

  const openAdjust = (stock: ApiInventoryStockItemDto) => {
    setAdjustTarget(stock);
    setAdjustDelta('');
    setAdjustReason('');
    setAdjustError(null);
  };

  const parsedDelta = Number(adjustDelta);
  const deltaValid = adjustDelta.trim() !== '' && Number.isInteger(parsedDelta) && parsedDelta !== 0;
  const onHandAfter = adjustTarget && deltaValid ? adjustTarget.on_hand + parsedDelta : null;

  const handleAdjust = async () => {
    if (!adjustTarget) return;
    if (!deltaValid) {
      setAdjustError('Số lượng chênh lệch phải là số nguyên khác 0 (dương = thừa, âm = thiếu / hỏng)');
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError('Cần nhập lý do điều chỉnh');
      return;
    }
    if (parsedDelta < 0 && -parsedDelta > adjustTarget.available) {
      setAdjustError(
        `Chỉ có thể giảm tối đa ${adjustTarget.available} (số còn bán) — phần còn lại đang được giữ / chốt cho đơn hàng`
      );
      return;
    }
    setIsAdjusting(true);
    setAdjustError(null);
    try {
      const res = await inventoryService.adjustStock({
        sku_id: adjustTarget.sku_id,
        quantity_delta: parsedDelta,
        reason: adjustReason.trim(),
      });
      onFeedback(
        `Đã điều chỉnh ${parsedDelta > 0 ? '+' : ''}${parsedDelta} cho ${adjustTarget.sku_code} (phiếu ${res.adjustment_code})`,
        'success'
      );
      setAdjustTarget(null);
      reload();
    } catch (err: unknown) {
      setAdjustError(err instanceof Error ? err.message : 'Điều chỉnh tồn kho thất bại');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const res = await inventoryService.reconcile();
      onFeedback(
        res.drifts.length === 0
          ? `Đã đối soát ${res.checked} SKU — không phát hiện sai lệch`
          : `Đã đối soát ${res.checked} SKU — sửa ${res.drifts.length} SKU bị lệch số còn bán`,
        'success'
      );
      setReconcileOpen(false);
      reload();
    } catch (err: unknown) {
      onFeedback(err instanceof Error ? err.message : 'Đối soát thất bại', 'error');
    } finally {
      setIsReconciling(false);
    }
  };

  const hasFilter = Boolean(search) || lowStockOnly;

  return (
    <div className="space-y-4">
      {/* Thanh công cụ */}
      <div className="bg-[#0F172A]/90 rounded-2xl p-3.5 border border-slate-800/80 flex flex-col md:flex-row gap-2.5 md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm, biến thể, mã SKU..."
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => changeSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => changeLowStockOnly(e.target.checked)}
              className="accent-indigo-500 cursor-pointer"
            />
            Sắp hết hàng (còn bán ≤ {LOW_STOCK_THRESHOLD})
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReconcileOpen(true)}
            className="px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Đối soát số còn bán
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Bảng tồn kho */}
      <div className="bg-[#0F172A]/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/70 text-slate-400 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <th className="py-3 px-4">Sản Phẩm / SKU</th>
                <th className="py-3 px-4">Kho</th>
                <th className="py-3 px-4 text-right">Tồn Thực Tế</th>
                <th className="py-3 px-4 text-right">Đã Chốt</th>
                <th className="py-3 px-4 text-right">Đang Giữ</th>
                <th className="py-3 px-4 text-right">Còn Bán</th>
                <th className="py-3 px-4 w-4" />
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <SkeletonRows cols={COLS} rows={Math.min(limit, 8)} />
              ) : loadError ? (
                <ErrorRow cols={COLS} message={loadError} onRetry={reload} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="py-16 text-center space-y-3">
                    <Boxes className="w-10 h-10 text-slate-700 mx-auto" />
                    <p className="text-sm font-bold text-white">
                      {hasFilter ? 'Không có SKU nào khớp bộ lọc' : 'Chưa có dữ liệu tồn kho'}
                    </p>
                    {hasFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setLowStockOnly(false);
                          setPage(1);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer active:scale-95"
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((s) => (
                  <tr key={`${s.sku_id}_${s.warehouse_id}`} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-white truncate max-w-[320px]" title={s.product_name}>
                        {s.product_name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {s.sku_name} · <span className="font-mono text-slate-500">{s.sku_code}</span>
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] whitespace-nowrap px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60">
                        {s.warehouse_code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">{formatNumber(s.on_hand)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-blue-300">{formatNumber(s.reserved)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-amber-300">{formatNumber(s.held)}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-black ${
                          s.available <= 0
                            ? 'text-rose-400'
                            : s.available <= LOW_STOCK_THRESHOLD
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                        }`}
                      >
                        {formatNumber(s.available)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {s.available <= 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
                          Hết hàng
                        </span>
                      ) : s.available <= LOW_STOCK_THRESHOLD ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                          Sắp hết
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Tooltip content="Xem sổ xuất nhập tồn của SKU">
                          <button
                            type="button"
                            onClick={() => onViewLedger(s)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer active:scale-95"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Điều chỉnh kiểm kê">
                          <button
                            type="button"
                            onClick={() => openAdjust(s)}
                            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loadError && total > 0 && (
          <PaginationBar
            page={page}
            limit={limit}
            total={total}
            unitLabel="SKU"
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* Drawer điều chỉnh kiểm kê */}
      {adjustTarget && (
        <ResizableDrawer
          isOpen={!!adjustTarget}
          onClose={() => setAdjustTarget(null)}
          storageKey="admin_inventory_adjust_width"
          defaultWidth={560}
          minWidth={420}
          title={<span className="text-base font-black text-white">Điều Chỉnh Kiểm Kê</span>}
          subtitle={
            <span className="text-[11px] text-slate-400">
              {adjustTarget.product_name} · {adjustTarget.sku_name} ·{' '}
              <span className="font-mono">{adjustTarget.sku_code}</span>
            </span>
          }
          bodyClassName="p-5 sm:p-6 space-y-5"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAdjust}
                disabled={isAdjusting}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
              >
                {isAdjusting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
                Ghi Phiếu Điều Chỉnh
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            {[
              { label: 'Tồn thực tế', value: adjustTarget.on_hand, className: 'text-white' },
              { label: 'Đã chốt', value: adjustTarget.reserved, className: 'text-blue-300' },
              { label: 'Đang giữ', value: adjustTarget.held, className: 'text-amber-300' },
              { label: 'Còn bán', value: adjustTarget.available, className: 'text-emerald-400' },
            ].map((m) => (
              <div key={m.label} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">{m.label}</span>
                <span className={`text-lg font-black ${m.className}`}>{formatNumber(m.value)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 block">Số lượng chênh lệch *</label>
            <input
              type="number"
              step={1}
              value={adjustDelta}
              placeholder="Ví dụ: 3 (thừa) hoặc -2 (thiếu / hỏng)"
              onChange={(e) => setAdjustDelta(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-hidden focus:border-indigo-500"
            />
            {onHandAfter !== null && (
              <p className="text-[11px] text-slate-400">
                Tồn thực tế sau điều chỉnh:{' '}
                <span className="font-bold text-white">{formatNumber(adjustTarget.on_hand)}</span>
                {' → '}
                <span className={`font-bold ${parsedDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatNumber(onHandAfter)}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 block">Lý do *</label>
            <div className="flex flex-wrap gap-1.5">
              {ADJUST_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAdjustReason(r)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                    adjustReason === r
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={adjustReason}
              maxLength={500}
              placeholder="Mô tả nguyên nhân chênh lệch"
              onChange={(e) => setAdjustReason(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {adjustError && (
            <p className="p-2.5 rounded-xl text-[11px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/80">
              {adjustError}
            </p>
          )}
        </ResizableDrawer>
      )}

      {/* Modal xác nhận đối soát */}
      {reconcileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#0F172A] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-amber-900/40 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Đối Soát Số Còn Bán</h3>
              <button
                type="button"
                onClick={() => setReconcileOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs space-y-2 text-slate-300">
              <p>
                Tính lại số còn bán của toàn bộ SKU từ cơ sở dữ liệu (tồn thực tế − đã chốt − đang giữ) và ghi đè bộ đếm
                bán hàng.
              </p>
              <p className="text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-[11px]">
                Chỉ nên chạy khi ít đơn hàng đang được đặt: giá trị ghi đè có thể lệch nếu đúng lúc đó có khách đang giữ
                hàng.
              </p>
            </div>
            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReconcileOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 text-xs font-semibold hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleReconcile}
                disabled={isReconciling}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
              >
                {isReconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                Chạy Đối Soát
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
