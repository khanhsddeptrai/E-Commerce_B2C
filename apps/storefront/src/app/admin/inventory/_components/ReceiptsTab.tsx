'use client';

import React, { useState } from 'react';
import { Search, X, RefreshCw, Plus, Loader2, FileText, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import { ApiInventoryStockItemDto, ApiReceiptDto } from '@/types/ecommerce';
import { ResizableDrawer } from '@/components/ResizableDrawer';
import {
  ErrorRow,
  FeedbackHandler,
  PaginationBar,
  SkeletonRows,
  formatActor,
  formatDateTime,
  formatNumber,
  formatPrice,
  useDebouncedValue,
  useRemoteData,
} from './shared';

const COLS = 7;

interface ReceiptLine {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  product_name: string;
  quantity: string;
  cost_price: string;
}

interface ReceiptsTabProps {
  onFeedback: FeedbackHandler;
}

export function ReceiptsTab({ onFeedback }: ReceiptsTabProps) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const query = { page, limit, search: debouncedSearch || undefined };
  const { data, error: loadError, isLoading } = useRemoteData(`${JSON.stringify(query)}#${reloadKey}`, () =>
    inventoryService.getReceipts(query)
  );
  const items: ApiReceiptDto[] = data?.items ?? [];
  const total = data?.total ?? 0;

  // Drawer tạo phiếu nhập
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [skuQuery, setSkuQuery] = useState('');
  const debouncedSkuQuery = useDebouncedValue(skuQuery.trim(), 300);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Tìm SKU để thêm vào phiếu nhập
  const skuSearchEnabled = createOpen && debouncedSkuQuery.length > 0;
  const skuSearch = useRemoteData(
    `sku:${debouncedSkuQuery}`,
    () => inventoryService.getStocks({ search: debouncedSkuQuery, limit: 10 }),
    skuSearchEnabled
  );
  const skuResults: ApiInventoryStockItemDto[] = skuSearchEnabled ? (skuSearch.data?.items ?? []) : [];
  const isSearchingSku = skuSearch.isLoading;

  const reload = () => setReloadKey((k) => k + 1);
  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const openCreate = () => {
    setCreateOpen(true);
    setSupplierName('');
    setNote('');
    setLines([]);
    setSkuQuery('');
    setCreateError(null);
  };

  const addLine = (sku: ApiInventoryStockItemDto) => {
    setLines((prev) =>
      prev.some((l) => l.sku_id === sku.sku_id)
        ? prev
        : [
            ...prev,
            {
              sku_id: sku.sku_id,
              sku_code: sku.sku_code,
              sku_name: sku.sku_name,
              product_name: sku.product_name,
              quantity: '1',
              cost_price: '0',
            },
          ]
    );
    setSkuQuery('');
  };

  const updateLine = (skuId: string, field: 'quantity' | 'cost_price', value: string) => {
    setLines((prev) => prev.map((l) => (l.sku_id === skuId ? { ...l, [field]: value } : l)));
  };

  const totalQuantity = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  const totalCost = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.cost_price) || 0), 0);

  const handleCreate = async () => {
    if (!supplierName.trim()) {
      setCreateError('Cần nhập tên nhà cung cấp');
      return;
    }
    if (lines.length === 0) {
      setCreateError('Phiếu nhập phải có ít nhất 1 sản phẩm');
      return;
    }
    const invalid = lines.find((l) => {
      const q = Number(l.quantity);
      const c = Number(l.cost_price);
      return !Number.isInteger(q) || q <= 0 || l.cost_price.trim() === '' || !Number.isFinite(c) || c < 0;
    });
    if (invalid) {
      setCreateError(`Dòng ${invalid.sku_code}: số lượng phải là số nguyên dương và giá vốn không âm`);
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const receipt = await inventoryService.createReceipt({
        supplier_name: supplierName.trim(),
        note: note.trim() || undefined,
        items: lines.map((l) => ({ sku_id: l.sku_id, quantity: Number(l.quantity), cost_price: Number(l.cost_price) })),
      });
      onFeedback(`Đã tạo phiếu nhập ${receipt.code} — nhập ${formatNumber(receipt.total_quantity)} sản phẩm vào kho`, 'success');
      setCreateOpen(false);
      setPage(1);
      reload();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Tạo phiếu nhập thất bại');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Thanh công cụ */}
      <div className="bg-[#0F172A]/90 rounded-2xl p-3.5 border border-slate-800/80 flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo mã phiếu, nhà cung cấp..."
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/25 cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo Phiếu Nhập
          </button>
        </div>
      </div>

      {/* Bảng phiếu nhập */}
      <div className="bg-[#0F172A]/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/70 text-slate-400 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <th className="py-3 px-4">Mã Phiếu</th>
                <th className="py-3 px-4">Nhà Cung Cấp</th>
                <th className="py-3 px-4">Kho</th>
                <th className="py-3 px-4 text-right">Tổng SL</th>
                <th className="py-3 px-4 text-right">Tổng Giá Vốn</th>
                <th className="py-3 px-4">Người Tạo</th>
                <th className="py-3 px-4">Thời Gian</th>
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
                    <FileText className="w-10 h-10 text-slate-700 mx-auto" />
                    <p className="text-sm font-bold text-white">
                      {search ? 'Không có phiếu nhập nào khớp tìm kiếm' : 'Chưa có phiếu nhập kho nào'}
                    </p>
                    <button
                      type="button"
                      onClick={search ? () => changeSearch('') : openCreate}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer active:scale-95"
                    >
                      {search ? 'Xóa tìm kiếm' : 'Tạo phiếu nhập đầu tiên'}
                    </button>
                  </td>
                </tr>
              ) : (
                items.map((r) => {
                  const expanded = expandedId === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 font-mono font-bold text-indigo-400 whitespace-nowrap">
                            {expanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            {r.code}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-white">{r.supplier_name}</p>
                          {r.note && <p className="text-[11px] text-slate-500 truncate max-w-[260px]">{r.note}</p>}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">{r.warehouse_code}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          +{formatNumber(r.total_quantity)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-white">{formatPrice(r.total_cost)}</td>
                        <td className="py-3 px-4 text-slate-400">{formatActor(r.created_by)}</td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-950/50">
                          <td colSpan={COLS} className="px-4 py-3">
                            <table className="w-full text-[11px]">
                              <thead className="text-slate-500 border-b border-slate-800/60">
                                <tr>
                                  <th className="py-1.5 px-2 text-left font-semibold">Sản phẩm</th>
                                  <th className="py-1.5 px-2 text-left font-semibold">Mã SKU</th>
                                  <th className="py-1.5 px-2 text-right font-semibold">Số lượng</th>
                                  <th className="py-1.5 px-2 text-right font-semibold">Giá vốn</th>
                                  <th className="py-1.5 px-2 text-right font-semibold">Thành tiền</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {r.items.map((i) => (
                                  <tr key={i.sku_id}>
                                    <td className="py-1.5 px-2 text-slate-200">
                                      {i.product_name} <span className="text-slate-500">· {i.sku_name}</span>
                                    </td>
                                    <td className="py-1.5 px-2 font-mono text-slate-400">{i.sku_code}</td>
                                    <td className="py-1.5 px-2 text-right font-bold text-white">{formatNumber(i.quantity)}</td>
                                    <td className="py-1.5 px-2 text-right text-slate-300">{formatPrice(i.cost_price)}</td>
                                    <td className="py-1.5 px-2 text-right text-slate-200">
                                      {formatPrice(i.cost_price * i.quantity)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loadError && total > 0 && (
          <PaginationBar
            page={page}
            limit={limit}
            total={total}
            unitLabel="phiếu nhập"
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        )}
      </div>

      {/* Drawer tạo phiếu nhập */}
      {createOpen && (
        <ResizableDrawer
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          storageKey="admin_inventory_receipt_width"
          defaultWidth={760}
          title={<span className="text-base font-black text-white">Tạo Phiếu Nhập Kho</span>}
          subtitle={<span className="text-[11px] text-slate-400">Nhập vào kho mặc định</span>}
          bodyClassName="p-5 sm:p-6 space-y-5"
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              <span className="text-xs text-slate-400">
                Tổng: <strong className="text-white">{formatNumber(totalQuantity)}</strong> sản phẩm ·{' '}
                <strong className="text-white">{formatPrice(totalCost)}</strong>
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed active:scale-95"
                >
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Lưu Phiếu Nhập
                </button>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">Nhà cung cấp *</label>
              <input
                type="text"
                value={supplierName}
                maxLength={255}
                placeholder="Ví dụ: Công ty TNHH Phân phối ABC"
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">Ghi chú</label>
              <input
                type="text"
                value={note}
                maxLength={1000}
                placeholder="Số hóa đơn, điều kiện giao hàng..."
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Tìm SKU */}
          <div className="space-y-1.5 text-xs relative">
            <label className="font-bold text-slate-300 block">Thêm sản phẩm</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={skuQuery}
                placeholder="Tìm theo tên sản phẩm, biến thể, mã SKU..."
                onChange={(e) => setSkuQuery(e.target.value)}
                className="w-full pl-9 pr-9 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-indigo-500"
              />
              {isSearchingSku && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin absolute right-3 top-3" />}
            </div>
            {skuQuery.trim() && debouncedSkuQuery === skuQuery.trim() && !isSearchingSku && (
              <div className="absolute left-0 right-0 z-20 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                {skuResults.length === 0 ? (
                  <p className="px-3 py-3 text-slate-400">Không tìm thấy SKU phù hợp</p>
                ) : (
                  skuResults.map((s) => {
                    const added = lines.some((l) => l.sku_id === s.sku_id);
                    return (
                      <button
                        key={s.sku_id}
                        type="button"
                        disabled={added}
                        onClick={() => addLine(s)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between gap-3 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold text-white truncate">{s.product_name}</span>
                          <span className="block text-[11px] text-slate-400">
                            {s.sku_name} · <span className="font-mono">{s.sku_code}</span>
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {added ? 'Đã thêm' : `Tồn: ${formatNumber(s.on_hand)}`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Danh sách dòng phiếu */}
          {lines.length === 0 ? (
            <div className="py-10 text-center bg-slate-950/50 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-500">
              Chưa có sản phẩm nào trong phiếu — tìm và thêm SKU ở ô phía trên
            </div>
          ) : (
            <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 divide-y divide-slate-800/80">
              {lines.map((l) => (
                <div key={l.sku_id} className="p-3 grid grid-cols-1 sm:grid-cols-[1fr_96px_140px_32px] gap-2.5 items-center text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{l.product_name}</p>
                    <p className="text-[11px] text-slate-400">
                      {l.sku_name} · <span className="font-mono">{l.sku_code}</span>
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Số lượng</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={l.quantity}
                      onChange={(e) => updateLine(l.sku_id, 'quantity', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-semibold focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Giá vốn (VND)</label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={l.cost_price}
                      onChange={(e) => updateLine(l.sku_id, 'cost_price', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-semibold focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((x) => x.sku_id !== l.sku_id))}
                    title="Bỏ dòng này"
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 self-end cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {createError && (
            <p className="p-2.5 rounded-xl text-[11px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/80">
              {createError}
            </p>
          )}
        </ResizableDrawer>
      )}
    </div>
  );
}
