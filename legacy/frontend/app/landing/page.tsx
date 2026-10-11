"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ParticleBackground from "@/components/landing/ParticleBackground";
import AuthModal from "@/components/landing/AuthModal";

// 🔥 The Next.js way to load Google Fonts (Zero flicker, perfectly optimized)
import { Bebas_Neue, Playfair_Display } from "next/font/google";

const bebas = Bebas_Neue({ 
  weight: '400', 
  subsets: ['latin'],
  display: 'swap',
});

const playfair = Playfair_Display({ 
  subsets: ['latin'],
  display: 'swap',
});

export default function LandingPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <main className="relative w-full h-screen bg-gray-50 dark:bg-black overflow-hidden flex items-center transition-colors duration-300">
      {/* 1. The Interactive 3D WebGL Background */}
      <ParticleBackground />

      {/* 2. Premium Grid / Margin Line */}
      <div className="absolute left-8 md:left-24 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-gray-400/40 dark:via-white/10 to-transparent z-10 hidden md:block" />
      
      {/* 3. The Content Foreground */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-8 md:px-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-4xl"
        >
          {/* Eyebrow Text - Playfair */}
          <div className="flex items-center gap-4 mb-6">
            <span className="w-8 h-[1px] bg-purple-500"></span>
            <p className={`text-purple-400 text-sm md:text-base tracking-[0.2em] uppercase font-semibold ${playfair.className}`}>
              ai powered interview app
            </p>
          </div>

          {/* Main Cinematic Headline - Bebas Neue */}
          {/* Note: Bebas is naturally narrow, so we make it massive (text-6xl to text-[100px]) */}
          <h1 className={`text-6xl md:text-8xl lg:text-[100px] text-gray-900 dark:text-white tracking-wide leading-[0.9] mb-8 ${bebas.className}`}>
            Master Communication.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-white">Command Confidence.</span><br />
            Conquer Interviews.
          </h1>

          {/* Muted Subheadline Quote - Playfair Display Italic */}
           <p className={`text-gray-700 dark:text-white/70 text-lg md:text-2xl font-light italic mb-12 pl-4 border-l-2 border-purple-500/50 ${playfair.className}`}>
            "Talent gets noticed. Presence gets hired."
          </p>

          {/* Minimalist Glowing Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAuthModalOpen(true)}
            className={`group relative px-8 py-4 bg-white text-black font-semibold rounded-full overflow-hidden transition-all ${playfair.className}`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-500 opacity-0 group-hover:opacity-10 transition-opacity" />
            <span className="relative flex items-center gap-2 text-lg">
              Get Started
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </motion.button>
        </motion.div>
      </div>

      {/* Auth Modal Hookup */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </main>
  );
}
