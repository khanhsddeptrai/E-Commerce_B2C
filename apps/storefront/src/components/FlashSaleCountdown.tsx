"use client";

import React, { useState, useEffect } from "react";
import { Timer, Zap } from "lucide-react";

export function FlashSaleCountdown() {
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 28, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 4, minutes: 0, seconds: 0 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const format2 = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-full text-amber-600">
      <div className="flex items-center gap-1.5 font-bold text-xs">
        <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500 animate-bounce" />
        <span>KẾT THÚC TRONG</span>
      </div>
      <div className="flex items-center gap-1 text-xs font-mono font-bold text-slate-900">
        <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded">
          {format2(timeLeft.hours)}
        </span>
        <span>:</span>
        <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded">
          {format2(timeLeft.minutes)}
        </span>
        <span>:</span>
        <span className="bg-slate-900 text-white px-1.5 py-0.5 rounded">
          {format2(timeLeft.seconds)}
        </span>
      </div>
    </div>
  );
}
