"use client";

import { useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import AdvancedParticles from "./AdvancedParticles";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export default function HeroSection({ onGetStarted }: HeroSectionProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const title = titleRef.current;
    const subtitle = subtitleRef.current;

    if (title) {
      const chars = title.innerText.split("");
      title.innerHTML = chars.map((char) => 
        `<span style="display: inline-block; opacity: 0; transform: translateY(-80px)">${char === " " ? "&nbsp;" : char}</span>`
      ).join("");
      
      gsap.to(title.querySelectorAll("span"), {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.03,
        ease: "power4.out",
        delay: 0.3,
      });
    }

    if (subtitle) {
      const chars = subtitle.innerText.split("");
      subtitle.innerHTML = chars.map((char) => 
        `<span style="display: inline-block; opacity: 0; transform: translateY(-80px)">${char === " " ? "&nbsp;" : char}</span>`
      ).join("");
      
      gsap.to(subtitle.querySelectorAll("span"), {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.03,
        ease: "power4.out",
        delay: 0.8,
      });
    }
  }, []);

  return (
    <section id="section-0" className="relative w-full h-screen overflow-hidden bg-[#080808]">
      <div className="fixed inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 10], fov: 70 }}
          gl={{ 
            antialias: false,
            alpha: true,
            powerPreference: 'high-performance',
            pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 1.5) : 1
          }}
        >
          <AdvancedParticles />
        </Canvas>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-8">
        <div className="absolute top-8 left-8 right-8 flex justify-between items-center">
          <div className="text-white text-lg tracking-[0.2em] font-bold">
            BLACKBOX.AI
          </div>
          <button
            onClick={onGetStarted}
            className="text-white/60 hover:text-white text-sm transition-colors"
          >
            Sign In
          </button>
        </div>

        <div className="text-center space-y-6 max-w-4xl">
          <h1 ref={titleRef} className="text-7xl md:text-9xl font-black tracking-tight text-white leading-none">
            MASTER EVERY
          </h1>
          <h1 ref={subtitleRef} className="text-7xl md:text-9xl font-black tracking-tight text-white leading-none">
            INTERVIEW
          </h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.6, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3 }}
            className="text-xl text-white/60 max-w-2xl mx-auto"
          >
            AI-powered coaching for HR, Behavioral, Technical & more.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/40 text-sm flex flex-col items-center gap-2"
        >
          <span>Scroll to explore</span>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-2"
          >
            <div className="w-1 h-2 bg-white/40 rounded-full" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
