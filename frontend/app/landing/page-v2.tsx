"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ParticleBackground from "@/components/landing/ParticleBackground";
import AuthModal from "@/components/landing/AuthModal";

export default function LandingPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <main className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center">
      {/* WebGL Particle Background */}
      <div className="absolute inset-0 z-0">
        <ParticleBackground />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-5xl">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-purple-400 uppercase tracking-[0.3em] text-xs md:text-sm mb-6 font-light"
        >
          ai powered interview app
        </motion.p>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-white font-black text-5xl md:text-7xl lg:text-8xl leading-[1.1] tracking-tight mb-6"
        >
          Master Communication.
          <br />
          Command Confidence.
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 bg-clip-text text-transparent">
            Conquer Interviews.
          </span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-white/60 text-lg md:text-xl italic mb-12 max-w-2xl"
        >
          Talent gets noticed. Presence gets hired.
        </motion.p>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAuthModalOpen(true)}
          className="relative px-12 py-5 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 text-white text-lg font-bold rounded-full shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 overflow-hidden group"
        >
          <span className="relative z-10">Get Started</span>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </motion.button>

        {/* Subtle hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="text-white/40 text-sm mt-8"
        >
          Join thousands mastering their interview skills with AI
        </motion.p>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </main>
  );
}
