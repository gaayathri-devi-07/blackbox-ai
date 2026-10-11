import { cn } from "@/lib/utils";

/** Wordmark: a solid square with an inset frame — the "black box". */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6", className)}>
      <rect x="2" y="2" width="20" height="20" rx="4" className="fill-foreground" />
      <rect x="7" y="7" width="10" height="10" rx="1.5" className="fill-none stroke-background" strokeWidth="1.75" />
    </svg>
  );
}

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      {!compact && <span className="text-[15px] font-semibold tracking-tight">Blackbox</span>}
    </span>
  );
}
