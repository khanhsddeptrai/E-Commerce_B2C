'use client';

import React, { useState, useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';

export interface ResizableDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  headerBottom?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  storageKey?: string;
  className?: string;
  bodyClassName?: string;
}

export function ResizableDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  headerActions,
  headerBottom,
  footer,
  children,
  defaultWidth = 880,
  minWidth = 540,
  storageKey,
  className = '',
  bodyClassName = 'p-6 space-y-6',
}: ResizableDrawerProps) {
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined' && storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= minWidth) return parsed;
        }
      } catch {
        // Ignored if storage access fails
      }
    }
    return defaultWidth;
  });

  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Lắng nghe phím ESC để đóng Drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Xử lý kéo thả chuột cạnh trái để thay đổi chiều rộng
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const maxWidth = Math.floor(window.innerWidth * 0.96);
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setDrawerWidth(newWidth);
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, newWidth.toString());
          } catch {
            // Ignore storage write error
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, minWidth, storageKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop mờ */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Khung Drawer Container */}
      <div
        style={{
          width: isMaximized ? '96vw' : `${drawerWidth}px`,
          maxWidth: '98vw',
        }}
        className={`relative bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300 text-white ${
          isResizing ? 'transition-none select-none' : 'transition-[width] duration-200'
        } ${className}`}
      >
        {/* Thanh nắm kéo thả cạnh trái (Drag to Resize Handle) */}
        {!isMaximized && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className="absolute -left-2 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-indigo-500/20 active:bg-indigo-500/40 transition-colors z-20 flex items-center justify-center group"
            title="Kéo sang trái để mở rộng, kéo sang phải để thu nhỏ"
          >
            <div className="w-1 h-12 rounded-full bg-slate-700/60 group-hover:bg-indigo-400 group-active:bg-indigo-400 transition-colors" />
          </div>
        )}

        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="min-w-0 pr-4">
            {typeof title === 'string' ? (
              <h2 className="text-base font-black text-white truncate">{title}</h2>
            ) : (
              title
            )}
            {subtitle && (
              typeof subtitle === 'string' ? (
                <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
              ) : (
                subtitle
              )
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {headerActions}

            <Tooltip content={isMaximized ? 'Thu gọn kích thước' : 'Phóng to toàn màn hình'}>
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isMaximized ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </Tooltip>

            <Tooltip content="Đóng (Esc)">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Khối bổ trợ Header (Tabs hoặc Toolbar lọc phụ) */}
        {headerBottom && (
          <div className="border-b border-slate-800 bg-slate-950/40 shrink-0">
            {headerBottom}
          </div>
        )}

        {/* Thân Drawer cuộn nội dung */}
        <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer cố định phía dưới */}
        {footer && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/70 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
