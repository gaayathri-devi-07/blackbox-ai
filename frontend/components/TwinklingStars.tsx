'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

export default function TwinklingStars() {
  const starsRef = useRef<Star[]>([]);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const shootingStars = useMemo(
    () => [
      { id: 0, startTop: 18, endTop: 42, delay: 2 },
      { id: 1, startTop: 32, endTop: 58, delay: 6 },
      { id: 2, startTop: 46, endTop: 28, delay: 10 },
    ],
    []
  );

  useEffect(() => {
    setMounted(true);
    // Generate stars only once
    if (starsRef.current.length === 0) {
      const stars: Star[] = [];
      for (let i = 0; i < 200; i++) {
        stars.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 2 + 0.5,
          delay: Math.random() * 3,
          duration: Math.random() * 2 + 2,
        });
      }
      starsRef.current = stars;
    }
  }, []);

  // Avoid SSR/client mismatch and hide in light mode
  if (!mounted || resolvedTheme === 'light') return null;

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
      {starsRef.current.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
          }}
          animate={{
            opacity: [0.2, 1, 0.2],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      
      {/* Shooting stars */}
      {shootingStars.map((shootingStar) => (
        <motion.div
          key={`shooting-${shootingStar.id}`}
          className="absolute h-[1px] w-[80px] bg-gradient-to-r from-transparent via-white to-transparent"
          initial={{
            top: `${shootingStar.startTop}%`,
            left: "-100px",
            opacity: 0,
          }}
          animate={{
            left: "110%",
            top: `${shootingStar.endTop}%`,
            opacity: [0, 1, 0.8, 0],
          }}
          transition={{
            duration: 1.5,
            delay: shootingStar.delay,
            repeat: Infinity,
            repeatDelay: 8,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
