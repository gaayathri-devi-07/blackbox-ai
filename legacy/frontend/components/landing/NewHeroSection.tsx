"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export default function NewHeroSection() {
  return (
    <section id="hero" className="relative w-full h-screen flex items-center justify-center overflow-hidden">
      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg className="w-full h-full">
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <h1
            className="text-[clamp(3.5rem,9vw,8rem)] font-black leading-[1.05] tracking-[-0.03em] text-white mb-6"
            style={{ transform: "scaleY(1.15)" }}
          >
            The Future of
            <br />
            Learning is Here
          </h1>
          
          <motion.p
            className="text-[#94A3B8] text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto mb-12 leading-relaxed font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            AI-powered tools to help you grow, interview, and collaborate
          </motion.p>
        </motion.div>
        
        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 1,
            duration: 0.8,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        >
          <ChevronDown className="w-8 h-8 text-[#94A3B8]" />
        </motion.div>
      </div>
    </section>
  );
}
