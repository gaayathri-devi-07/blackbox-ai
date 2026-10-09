"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface Companion {
  id: string;
  name: string;
}

const COMPANION_EMOJIS: Record<string, string> = {
  luna: "🌙",
  nova: "⭐",
  stella: "✨",
  orion: "🌟",
  cosmo: "🪐",
};

export const COMPANION_COLORS: Record<string, string> = {
  luna: "#a78bfa",
  nova: "#60a5fa",
  stella: "#f472b6",
  orion: "#34d399",
  cosmo: "#fbbf24",
};

export function useCompanion() {
  const [companion, setCompanion] = useState<Companion | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("companion");
      if (stored) {
        try { setCompanion(JSON.parse(stored)); } catch { /* ignore */ }
      }
    }
  }, []);

  return companion;
}

export function companionColor(id: string) {
  return COMPANION_COLORS[id] ?? "#a78bfa";
}
export function companionEmoji(id: string) {
  return COMPANION_EMOJIS[id] ?? "⭐";
}

// ── Floating Companion Widget ────────────────────────────────────────────────
interface FloatingCompanionProps {
  message?: string;
  showMessage?: boolean;
}

export function FloatingCompanion({ message, showMessage }: FloatingCompanionProps) {
  const companion = useCompanion();
  if (!companion) return null;

  const color = companionColor(companion.id);
  const emoji = companionEmoji(companion.id);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {showMessage && message && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 6 }}
            className="rounded-2xl rounded-br-sm px-3 py-2 text-[11px] font-semibold text-center"
            style={{
              maxWidth: 180,
              background: "rgba(5,2,20,0.92)",
              backdropFilter: "blur(20px)",
              border: `1px solid ${color}55`,
              color,
            }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${color}cc, ${color}44)`,
          boxShadow: `0 0 20px ${color}55`,
          border: `2px solid ${color}66`,
        }}
      >
        {emoji}
      </motion.div>
    </div>
  );
}

// ── Cosmic page wrapper ──────────────────────────────────────────────────────
import { StarField } from "@/components/star-field";

interface CosmicLayoutProps {
  children: React.ReactNode;
  nebula?: boolean;
}

export function CosmicLayout({ children, nebula = true }: CosmicLayoutProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#020010] text-slate-900 dark:text-white transition-colors duration-300">
      <StarField starCount={200} />
      {nebula && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-900/15 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-900/15 blur-[100px]" />
        </div>
      )}
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
