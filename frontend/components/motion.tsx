"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Text that resolves word by word from soft focus. Screen readers get the
 * plain sentence; the animated words are hidden from them.
 */
export function BlurText({
  text,
  className,
  delayMs = 0,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  delayMs?: number;
  as?: ElementType;
}) {
  const words = text.split(/(\s+)/);
  let index = 0;
  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) =>
          /^\s+$/.test(w) ? (
            w
          ) : (
            <span key={i} className="blur-word" style={{ "--i": index++, "--delay": `${delayMs}ms` } as React.CSSProperties}>
              {w}
            </span>
          )
        )}
      </span>
    </Tag>
  );
}

/** Rises and sharpens into place the first time it scrolls into view. */
export function Reveal({
  children,
  className,
  delayMs = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setVisible(true));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} data-visible={visible} className={cn("reveal", className)} style={{ "--delay": `${delayMs}ms` } as React.CSSProperties}>
      {children}
    </Tag>
  );
}
