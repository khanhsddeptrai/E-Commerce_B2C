'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { ApiInventoryStockItemDto } from '@/types/ecommerce';
import { StocksTab } from './_components/StocksTab';
import { ReceiptsTab } from './_components/ReceiptsTab';
import { LedgerSkuFilter, TransactionsTab } from './_components/TransactionsTab';

type InventoryTab = 'STOCKS' | 'RECEIPTS' | 'LEDGER';

const TABS: { id: InventoryTab; label: string }[] = [
  { id: 'STOCKS', label: 'Tồn kho' },
  { id: 'RECEIPTS', label: 'Phiếu nhập' },
  { id: 'LEDGER', label: 'Sổ xuất nhập tồn' },
];

export default function AdminInventoryPage() {
  const [activeTab, setActiveTab] = useState<InventoryTab>('STOCKS');
  const [ledgerSku, setLedgerSku] = useState<LedgerSkuFilter | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleViewLedger = (stock: ApiInventoryStockItemDto) => {
    setLedgerSku({
      sku_id: stock.sku_id,
      sku_code: stock.sku_code,
      sku_name: stock.sku_name,
      product_name: stock.product_name,
    });
    setActiveTab('LEDGER');
  };

  return (
    <div className="space-y-4 max-w-[1680px] mx-auto pb-20">
      <div className="pt-1">
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Quản Lý Kho</h1>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
              : 'bg-rose-950/60 text-rose-300 border border-rose-800/80'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer active:scale-95 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-bold'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'STOCKS' && (
        <StocksTab onFeedback={(text, type) => setFeedback({ text, type })} onViewLedger={handleViewLedger} />
      )}
      {activeTab === 'RECEIPTS' && <ReceiptsTab onFeedback={(text, type) => setFeedback({ text, type })} />}
      {activeTab === 'LEDGER' && <TransactionsTab skuFilter={ledgerSku} onClearSkuFilter={() => setLedgerSku(null)} />}
    </div>
  );
}
