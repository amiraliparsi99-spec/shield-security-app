"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: string; message: string; type: ToastType };

const ToastContext = createContext<{
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { show: () => {}, success: () => {}, error: () => {} };
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((message: string) => show(message, "success"), [show]);
  const error = useCallback((message: string) => show(message, "error"), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error }}>
      {children}
      <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              pointer-events-auto px-4 py-3 rounded-xl text-sm font-medium shadow-lg backdrop-blur-xl
              transition-all duration-200 ease-out
              ${t.type === "success" ? "bg-emerald-500/90 text-white border border-emerald-400/30" : ""}
              ${t.type === "error" ? "bg-red-500/90 text-white border border-red-400/30" : ""}
              ${t.type === "info" ? "glass-strong text-white border border-white/10" : ""}
            `}
          >
            {t.type === "success" && <span className="mr-2">✓</span>}
            {t.type === "error" && <span className="mr-2">!</span>}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
