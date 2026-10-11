"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignInCard } from "./sign-in-card";

interface LoginDialogContext {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<LoginDialogContext | null>(null);

export function useLoginDialog(): LoginDialogContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLoginDialog must be used inside <LoginDialogProvider>.");
  return ctx;
}

/**
 * The sign-in panel lives in a centred glass dialog that opens only when the
 * visitor asks for it. It opens automatically when they were sent here from a
 * protected page (?next=…) or arrive on /login#sign-in.
 */
export function LoginDialogProvider({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    // Portals and location.hash exist only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (params.get("next") || params.get("login") || window.location.hash === "#sign-in") setIsOpen(true);
  }, [params]);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {mounted && createPortal(<LoginDialog open={isOpen} onClose={close} />, document.body)}
    </Ctx.Provider>
  );
}

function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);

  // Keep the dialog mounted for its exit animation.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 260);
      return () => clearTimeout(t);
    }
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const focusFirst = setTimeout(() => panelRef.current?.querySelector<HTMLElement>("button:not(:disabled), input")?.focus(), 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusFirst);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!visible) return null;

  return (
    <div className="hero-scene fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-[oklch(0.25_0.04_160/0.28)] backdrop-blur-md transition-opacity duration-300",
          closing ? "opacity-0" : "opacity-100 animate-in fade-in"
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-title"
        className={cn("relative max-h-[calc(100dvh-2rem)] w-full max-w-[420px] overflow-y-auto rounded-[28px] scrollbar-thin", closing ? "login-dialog-out" : "login-dialog-in")}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign-in"
          className="absolute right-4 top-4 z-10 inline-flex size-8 items-center justify-center rounded-full border border-white/60 bg-white/50 text-(--hero-ink) transition-colors hover:bg-white/90"
        >
          <X className="size-4" />
        </button>
        <SignInCard />
      </div>
    </div>
  );
}

/** Any button that opens the sign-in dialog. */
export function LoginButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open } = useLoginDialog();
  return (
    <button type="button" onClick={open} className={className}>
      {children}
    </button>
  );
}
