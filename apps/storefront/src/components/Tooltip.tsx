'use client';

import React from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  className = '',
}: TooltipProps) {
  if (!content) return <>{children}</>;

  return (
    <div className={`relative group/tooltip inline-flex items-center justify-center ${className}`}>
      {children}
      <div
        role="tooltip"
        className={`absolute pointer-events-none z-50 whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-all duration-150 ease-out left-1/2 -translate-x-1/2 ${
          position === 'top'
            ? 'bottom-full mb-2 group-hover/tooltip:-translate-y-0.5'
            : 'top-full mt-2 group-hover/tooltip:translate-y-0.5'
        }`}
      >
        <div className="bg-slate-950 text-slate-100 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-700/80 shadow-xl shadow-black/60">
          {content}
        </div>
        {position === 'top' ? (
          <div className="w-1.5 h-1.5 bg-slate-950 border-r border-b border-slate-700/80 rotate-45 mx-auto -mt-1" />
        ) : (
          <div className="w-1.5 h-1.5 bg-slate-950 border-l border-t border-slate-700/80 rotate-45 mx-auto -mb-1" />
        )}
      </div>
    </div>
  );
}
