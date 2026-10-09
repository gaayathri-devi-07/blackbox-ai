"use client";

import { useEffect, useRef, useState } from "react";

export default function Loader({ onComplete }: { onComplete: () => void }) {
  const loaderRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;

    let startTime: number | null = null;
    const duration = 2500; // 2.5 seconds

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      setProgress(Math.round(eased * 100));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Fade out after completion
        setTimeout(() => {
          if (loader) {
            loader.style.opacity = "0";
            loader.style.transition = "opacity 0.4s ease-out";
            setTimeout(() => onComplete(), 400);
          }
        }, 200);
      }
    };

    requestAnimationFrame(animate);
  }, [onComplete]);

  return (
    <div
      ref={loaderRef}
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center"
    >
      {/* App name/logo */}
      <div
        className="text-[clamp(3rem,8vw,6rem)] font-black text-white tracking-[-0.04em] mb-12"
        style={{ transform: "scaleY(1.2)" }}
      >
        BLACKBOX.AI
      </div>

      {/* Loading counter */}
      <div className="text-[1.2rem] font-mono font-bold text-[#94A3B8] mb-4">
        Loading... {progress}%
      </div>

      {/* Progress bar */}
      <div className="w-[400px] max-w-[80vw] h-[2px] bg-transparent overflow-hidden">
        <div
          className="h-full bg-[#38BDF8] transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
