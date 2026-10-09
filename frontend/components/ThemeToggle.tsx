"use client";

import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 dark:bg-white/10 backdrop-blur-sm border border-gray-300 dark:border-white/20 hover:bg-gray-300 dark:hover:bg-white/20 transition-all duration-300 group"
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{
          scale: isDark ? 1 : 0,
          rotate: isDark ? 0 : 180,
        }}
        transition={{ duration: 0.3 }}
        className="absolute"
      >
        <Moon className="w-5 h-5 text-purple-300" />
      </motion.div>
      
      <motion.div
        initial={false}
        animate={{
          scale: isDark ? 0 : 1,
          rotate: isDark ? -180 : 0,
        }}
        transition={{ duration: 0.3 }}
        className="absolute"
      >
        <Sun className="w-5 h-5 text-yellow-400" />
      </motion.div>
      
      {/* Glow effect */}
      <div className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-300 ${
        isDark ? 'bg-purple-500/20 opacity-0 group-hover:opacity-100' : 'bg-yellow-500/20 opacity-0 group-hover:opacity-100'
      }`} />
    </motion.button>
  );
}
