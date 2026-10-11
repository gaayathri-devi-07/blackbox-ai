"use client";

import { motion } from "framer-motion";

interface SpeakingIndicatorProps {
  color?: string;
  size?: "sm" | "md" | "lg";
  label?: boolean;
}

/** Animated bouncing-bars speaking indicator */
export default function SpeakingIndicator({
  color = "#7c3aed",
  size = "md",
  label = true,
}: SpeakingIndicatorProps) {
  const heights = [6, 10, 8, 12, 7];
  const sizeMap = { sm: 0.7, md: 1, lg: 1.4 };
  const scale = sizeMap[size];

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-end gap-[3px]" style={{ height: 14 * scale }}>
        {heights.map((h, i) => (
          <motion.div
            key={i}
            style={{
              width: 3 * scale,
              background: color,
              borderRadius: 2,
              transformOrigin: "bottom",
            }}
            animate={{ scaleY: [0.3, 1, 0.3], height: h * scale }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.08,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      {label && (
        <span className="text-[11px] font-semibold" style={{ color }}>
          Speaking
        </span>
      )}
    </div>
  );
}
