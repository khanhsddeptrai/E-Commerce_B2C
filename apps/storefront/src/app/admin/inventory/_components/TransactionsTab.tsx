'use client';

import React, { useState } from 'react';
import { Search, X, RefreshCw, History } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import { ApiInventoryTransactionDto, InventoryTransactionType } from '@/types/ecommerce';
import {
  ErrorRow,
  PaginationBar,
  SkeletonRows,
  TRANSACTION_TYPE_CONFIG,
  formatActor,
  formatDateTime,
  formatNumber,
  useDebouncedValue,
  useRemoteData,
} from './shared';

const COLS = 7;

export interface LedgerSkuFilter {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  product_name: string;
}

interface TransactionsTabProps {
  skuFilter: LedgerSkuFilter | null;
  onClearSkuFilter: () => void;
}

/** yyyy-mm-dd (giờ địa phương) → ISO đầu / cuối ngày */
const toIsoBoundary = (date: string, end: boolean) => {
  if (!date) return undefined;
  const d = new Date(`${date}T${end ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export function TransactionsTab({ skuFilter, onClearSkuFilter }: TransactionsTabProps) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [typeFilter, setTypeFilter] = useState<InventoryTransactionType | ''>('');
  const [refId, setRefId] = useState('');
  const debouncedRefId = useDebouncedValue(refId.trim());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const skuId = skuFilter?.sku_id;
  const dateRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);

  // Đổi SKU lọc (từ tab Tồn kho) → quay về trang 1; điều chỉnh state trong lúc render thay vì trong effect
  const [prevSkuId, setPrevSkuId] = useState(skuId);
  if (prevSkuId !== skuId) {
    setPrevSkuId(skuId);
    setPage(1);
  }

  const query = {
    page,
    limit,
    sku_id: skuId,
    type: typeFilter || undefined,
    ref_id: debouncedRefId || undefined,
    from: toIsoBoundary(fromDate, false),
    to: toIsoBoundary(toDate, true),
  };
  const { data, error: loadError, isLoading } = useRemoteData(
    `${JSON.stringify(query)}#${reloadKey}`,
    () => inventoryService.getTransactions(query),
    !dateRangeInvalid
  );
  const items: ApiInventoryTransactionDto[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const reload = () => setReloadKey((k) => k + 1);
  // Mọi thay đổi bộ lọc đều quay về trang 1
  const withPageReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };
  const changeTypeFilter = withPageReset(setTypeFilter);
  const changeRefId = withPageReset(setRefId);
  const changeFromDate = withPageReset(setFromDate);
  const changeToDate = withPageReset(setToDate);

  const hasFilter = Boolean(skuFilter || typeFilter || refId || fromDate || toDate);
  const clearFilters = () => {
    onClearSkuFilter();
    setTypeFilter('');
    setRefId('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Bộ lọc */}
      <div className="bg-[#0F172A]/90 rounded-2xl p-3.5 border border-slate-800/80 space-y-3">
        <div className="flex flex-col lg:flex-row gap-2.5 lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center flex-1 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Mã chứng từ (GRN, mã đơn, ADJ)..."
                value={refId}
                onChange={(e) => changeRefId(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              {refId && (
                <button
                  type="button"
                  onClick={() => changeRefId('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">Loại:</span>
              <select
                value={typeFilter}
                onChange={(e) => changeTypeFilter(e.target.value as InventoryTransactionType | '')}
                className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-white">
                  Tất cả
                </option>
                {(Object.keys(TRANSACTION_TYPE_CONFIG) as InventoryTransactionType[]).map((t) => (
                  <option key={t} value={t} className="bg-slate-900 text-white">
                    {TRANSACTION_TYPE_CONFIG[t].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">Từ</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => changeFromDate(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer [color-scheme:dark]"
              />
              <span className="text-[11px] text-slate-400 font-medium">đến</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => changeToDate(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-hidden cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 transition-colors cursor-pointer"
              >
                Đặt lại
              </button>
            )}
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

        {(skuFilter || dateRangeInvalid) && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/50 text-xs">
            {skuFilter && (
              <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                SKU: <strong>{skuFilter.product_name}</strong> · {skuFilter.sku_name} ·{' '}
                <span className="font-mono">{skuFilter.sku_code}</span>
                <button
                  type="button"
                  onClick={onClearSkuFilter}
                  title="Bỏ lọc SKU"
                  className="p-0.5 rounded-full hover:bg-indigo-500/20 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {dateRangeInvalid && <span className="text-rose-400 font-semibold">Ngày bắt đầu phải trước ngày kết thúc</span>}
          </div>
        )}
      </div>

      {/* Bảng sổ kho */}
      <div className="bg-[#0F172A]/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/70 text-slate-400 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <th className="py-3 px-4">Thời Gian</th>
                <th className="py-3 px-4">Sản Phẩm / SKU</th>
                <th className="py-3 px-4">Loại</th>
                <th className="py-3 px-4 text-right">Số Lượng</th>
                <th className="py-3 px-4 text-right">Tồn Sau</th>
                <th className="py-3 px-4">Chứng Từ</th>
                <th className="py-3 px-4">Ghi Chú / Người Thực Hiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <SkeletonRows cols={COLS} rows={Math.min(limit, 8)} />
              ) : loadError ? (
                <ErrorRow cols={COLS} message={loadError} onRetry={reload} />
              ) : dateRangeInvalid || items.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="py-16 text-center space-y-3">
                    <History className="w-10 h-10 text-slate-700 mx-auto" />
                    <p className="text-sm font-bold text-white">
                      {hasFilter ? 'Không có giao dịch kho nào khớp bộ lọc' : 'Sổ kho chưa có giao dịch nào'}
                    </p>
                    {hasFilter && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer active:scale-95"
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((t) => {
                  const cfg = TRANSACTION_TYPE_CONFIG[t.type] ?? TRANSACTION_TYPE_CONFIG.ADJUSTMENT;
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors align-top">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white truncate max-w-[260px]" title={t.product_name}>
                          {t.product_name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {t.sku_name} · <span className="font-mono text-slate-500">{t.sku_code}</span> ·{' '}
                          <span className="font-mono text-slate-500">{t.warehouse_code}</span>
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-black ${t.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {t.quantity > 0 ? `+${formatNumber(t.quantity)}` : formatNumber(t.quantity)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">{formatNumber(t.balance_after)}</td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => changeRefId(t.ref_id)}
                          title="Lọc theo chứng từ này"
                          className="font-mono font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer whitespace-nowrap"
                        >
                          {t.ref_id}
                        </button>
                        <p className="text-[10px] text-slate-500 uppercase">{t.ref_type}</p>
                      </td>
                      <td className="py-3 px-4">
                        {t.note && <p className="text-slate-300 max-w-[280px] break-words">{t.note}</p>}
                        <p className="text-[11px] text-slate-500">{formatActor(t.created_by)}</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loadError && !dateRangeInvalid && total > 0 && (
          <PaginationBar
            page={page}
            limit={limit}
            total={total}
            unitLabel="giao dịch"
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
