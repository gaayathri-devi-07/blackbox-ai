"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface NewCTASectionProps {
  onGetStarted: () => void;
}

export default function NewCTASection({ onGetStarted }: NewCTASectionProps) {
  return (
    <section
      id="cta"
      className="relative w-full h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <h2
            className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-8 leading-tight tracking-[-0.02em]"
            style={{ transform: "scaleY(1.15)" }}
          >
            Ready to Transform
            <br />
            Your Career?
          </h2>
          
          <motion.p
            className="text-xl text-[#94A3B8] mb-12 max-w-2xl mx-auto font-medium"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            Join thousands of learners who are leveling up their skills and landing their dream jobs.
          </motion.p>
          
          <motion.button
            onClick={onGetStarted}
            className="group relative px-12 py-5 text-xl font-bold text-white bg-[#7C3AED] rounded-full overflow-hidden transition-all duration-300 hover:scale-110 hover:shadow-[0_0_60px_rgba(124,58,237,0.8)]"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.6 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="relative z-10 flex items-center gap-3 text-white">
              Get Started Free
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </span>
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED] via-[#3B82F6] to-[#06B6D4] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Pulsing glow */}
            <div className="absolute -inset-2 bg-[#7C3AED] rounded-full opacity-40 group-hover:opacity-80 blur-2xl animate-pulse" />
          </motion.button>
          
          <motion.p
            className="mt-8 text-sm text-[#64748B]"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.9, duration: 1 }}
          >
            No credit card required • Get started in under 60 seconds
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
