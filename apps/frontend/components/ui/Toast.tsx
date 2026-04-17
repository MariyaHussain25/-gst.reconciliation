'use client';

/**
 * Toast notification system.
 * ToastProvider wraps the app; useToast() gives access to toast() anywhere.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ── Style maps ────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ComponentType<{ size?: number; color?: string }>> = {
  success: CheckCircle,
  error:   XCircle,
  info:    Info,
  warning: AlertTriangle,
};

const STYLES: Record<ToastType, { border: string; iconColor: string }> = {
  success: { border: 'rgba(34,197,94,0.45)',   iconColor: '#4ade80' },
  error:   { border: 'rgba(239,68,68,0.45)',   iconColor: '#f87171' },
  info:    { border: 'rgba(59,130,246,0.45)',  iconColor: '#60a5fa' },
  warning: { border: 'rgba(245,158,11,0.45)', iconColor: '#fbbf24' },
};

// ── Individual Toast card ─────────────────────────────────────────────────────

function ToastCard({
  item,
  onRemove,
}: {
  item: ToastItem;
  onRemove: (id: string) => void;
}): React.ReactElement {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    timer.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(item.id), 300);
    }, 4200);
    return () => {
      cancelAnimationFrame(raf);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [item.id, onRemove]);

  const s = STYLES[item.type];
  const Icon = ICONS[item.type];

  function dismiss() {
    setVisible(false);
    setTimeout(() => onRemove(item.id), 300);
  }

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        background: '#1c1c1c',
        border: `1px solid ${s.border}`,
        borderRadius: 12,
        padding: '13px 14px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
        maxWidth: 360,
        width: '100%',
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(24px) scale(0.95)',
        opacity: visible ? 1 : 0,
        transition:
          'transform 0.36s cubic-bezier(0.34,1.46,0.64,1), opacity 0.26s ease',
        willChange: 'transform, opacity',
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1, display: 'flex' }}>
        <Icon size={16} color={s.iconColor} />
      </span>
      <p style={{ flex: 1, fontSize: 13, color: '#e0e0e0', lineHeight: 1.5, margin: 0 }}>
        {item.message}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#555',
          padding: 2,
          flexShrink: 0,
          borderRadius: 4,
          transition: 'color 0.15s',
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = '#aaa';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = '#555';
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'flex-end',
          pointerEvents: 'auto',
        }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
