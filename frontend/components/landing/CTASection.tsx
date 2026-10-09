"use client";

import { motion } from "framer-motion";

interface CTASectionProps {
  onGetStarted: () => void;
}

export default function CTASection({ onGetStarted }: CTASectionProps) {
  return (
    <section id="section-3" className="relative w-full h-screen bg-[#080808] flex items-center justify-center overflow-hidden">
      <div className="relative z-10 text-center space-y-8 px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-indigo-500 text-xs tracking-[0.3em] uppercase font-bold"
        >
          BEGIN YOUR JOURNEY
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h2 className="text-7xl md:text-8xl font-black text-white mb-4">
            ARE YOU READY
          </h2>
          <h2 className="text-7xl md:text-8xl font-black text-white">
            TO ACE IT?
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 0.6, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg text-white/60 max-w-xl mx-auto"
        >
          Join thousands mastering interviews with AI-powered practice. Your next opportunity starts here.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          whileHover={{ 
            scale: 1.05,
            boxShadow: "0 0 60px rgba(255,255,255,0.3)",
            backgroundColor: "#ffffff"
          }}
          whileTap={{ scale: 0.98 }}
          onClick={onGetStarted}
          className="px-12 py-5 text-lg font-black bg-white text-black rounded transition-all"
        >
          GET STARTED — IT'S FREE →
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.4 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-sm text-white/40"
        >
          Already have an account?{" "}
          <button
            onClick={onGetStarted}
            className="underline hover:text-white/60 transition"
          >
            Sign in
          </button>
        </motion.p>
      </div>
    </section>
  );
}
