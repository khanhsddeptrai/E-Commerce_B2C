"use client";

import React from "react";
import { CheckCircle2, X } from "lucide-react";
import { useCart } from "@/context/CartContext";

export function Toast() {
  const { toastMessage, dismissToast } = useCart();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <span className="text-xs font-medium">{toastMessage}</span>
        <button
          onClick={dismissToast}
          className="text-slate-400 hover:text-white transition-colors ml-2"
          aria-label="Đóng thông báo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
