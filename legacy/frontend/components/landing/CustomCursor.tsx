"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const onMouseMove = (e: MouseEvent) => {
      gsap.set(dot, { x: e.clientX, y: e.clientY });
      gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.15, ease: "power2.out" });
    };

    const onMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" || 
        target.tagName === "A" || 
        (target.closest && target.closest("button")) || 
        (target.closest && target.closest("a"))
      ) {
        setIsHovering(true);
      }
    };

    const onMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" || 
        target.tagName === "A" ||
        (target.closest && target.closest("button")) || 
        (target.closest && target.closest("a"))
      ) {
        setIsHovering(false);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseenter", onMouseEnter, true);
    document.addEventListener("mouseleave", onMouseLeave, true);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseenter", onMouseEnter, true);
      document.removeEventListener("mouseleave", onMouseLeave, true);
    };
  }, []);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    if (isHovering) {
      gsap.to(dot, { scale: 0, duration: 0.2, ease: "power2.out" });
      gsap.to(ring, {
        scale: 2.5,
        backgroundColor: "rgba(108, 99, 255, 0.2)",
        duration: 0.2,
        ease: "power2.out",
      });
    } else {
      gsap.to(dot, { scale: 1, duration: 0.2, ease: "power2.out" });
      gsap.to(ring, {
        scale: 1,
        backgroundColor: "transparent",
        duration: 0.2,
        ease: "power2.out",
      });
    }
  }, [isHovering]);

  return (
    <>
      <div
        ref={dotRef}
        className="fixed w-1.5 h-1.5 rounded-full bg-white pointer-events-none z-[99999] -translate-x-1/2 -translate-y-1/2 mix-blend-difference"
      />
      <div
        ref={ringRef}
        className="fixed w-8 h-8 border border-indigo-500/60 rounded-full pointer-events-none z-[99998] -translate-x-1/2 -translate-y-1/2"
      />
    </>
  );
}
