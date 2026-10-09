"use client";

import { motion } from "framer-motion";

interface HandRaiseButtonProps {
  raised: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** User's raise-hand button with animated hand icon */
export default function HandRaiseButton({ raised, disabled = false, onClick }: HandRaiseButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all select-none"
      style={{
        background: raised
          ? "linear-gradient(135deg, #f59e0b, #d97706)"
          : "linear-gradient(135deg, #4c1d95, #7c3aed)",
        color: "#fff",
        boxShadow: raised ? "0 0 20px #f59e0b66" : "0 0 14px #7c3aed44",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <motion.span
        animate={raised ? { rotate: [0, -10, 10, -5, 0], y: [0, -4, 0] } : {}}
        transition={{ duration: 0.5 }}
        className="text-lg"
      >
        ✋
      </motion.span>
      <span>{raised ? "Hand Raised" : "Raise Hand"}</span>

      {raised && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          style={{ boxShadow: "inset 0 0 12px #f59e0b66" }}
        />
      )}
    </motion.button>
  );
}
