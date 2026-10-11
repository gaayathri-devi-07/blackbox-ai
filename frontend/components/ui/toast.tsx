"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "error";
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

interface ToastApi {
  notify: (toast: Omit<Toast, "id">) => void;
  error: (title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notify = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.tone === "error" ? 7000 : 4500);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      notify,
      error: (title, description) => notify({ tone: "error", title, description }),
      success: (title, description) => notify({ tone: "success", title, description }),
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.tone === "error" ? AlertCircle : t.tone === "success" ? CheckCircle2 : Info;
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex items-start gap-3 rounded-lg border bg-popover p-3.5 text-popover-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2"
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  t.tone === "error" ? "text-danger" : t.tone === "success" ? "text-success" : "text-accent"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}
