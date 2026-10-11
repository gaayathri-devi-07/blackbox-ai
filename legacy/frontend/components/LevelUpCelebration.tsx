"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Trophy, Star, TrendingUp, Award } from "lucide-react";
import { GamificationUpdate } from "@/lib/gamification";

interface LevelUpCelebrationProps {
  gamificationData: GamificationUpdate;
  sessionScore: number;
  keyImprovementTip: string;
  onContinue: () => void;
}

export default function LevelUpCelebration({
  gamificationData,
  sessionScore,
  keyImprovementTip,
  onContinue,
}: LevelUpCelebrationProps) {
  const [countedScore, setCountedScore] = useState(0);
  const [showPoints, setShowPoints] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showBadges, setShowBadges] = useState(false);

  useEffect(() => {
    // Count up score animation
    const duration = 2000;
    const steps = 60;
    const increment = sessionScore / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= sessionScore) {
        setCountedScore(sessionScore);
        clearInterval(timer);
        setTimeout(() => setShowPoints(true), 300);
      } else {
        setCountedScore(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [sessionScore]);

  useEffect(() => {
    if (showPoints) {
      setTimeout(() => {
        if (gamificationData.leveledUp) {
          setShowLevelUp(true);
          // Trigger confetti
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#7C3AED", "#3B82F6", "#06B6D4"],
          });
        } else {
          setTimeout(() => setShowBadges(true), 500);
        }
      }, 1000);
    }
  }, [showPoints, gamificationData.leveledUp]);

  useEffect(() => {
    if (showLevelUp) {
      setTimeout(() => setShowBadges(true), 2000);
    }
  }, [showLevelUp]);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Score Count-Up */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-white/80 mb-4">Interview Complete!</h2>
          <div className="text-8xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-4">
            {countedScore}%
          </div>
          <p className="text-white/60">Your Score</p>
        </motion.div>

        {/* Points Earned */}
        <AnimatePresence>
          {showPoints && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-2xl font-bold"
              >
                <Star className="w-8 h-8" />
                +{gamificationData.pointsEarned} Points
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level Up */}
        <AnimatePresence>
          {showLevelUp && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring" }}
              className="text-center mb-12"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: 3, duration: 0.5 }}
                className="inline-block mb-4"
              >
                <Trophy className="w-24 h-24 text-yellow-400" />
              </motion.div>
              <h3 className="text-4xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
                LEVEL UP!
              </h3>
              <p className="text-2xl font-bold text-white">
                You're now Level {gamificationData.newLevel}!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Badges */}
        <AnimatePresence>
          {showBadges && gamificationData.newBadges.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <h4 className="text-xl font-bold text-white text-center mb-4 flex items-center justify-center gap-2">
                <Award className="w-6 h-6" />
                New Badges Earned!
              </h4>
              <div className="flex justify-center gap-4">
                {gamificationData.newBadges.slice(0, 3).map((badgeId, idx) => (
                  <motion.div
                    key={badgeId}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 * idx }}
                    className="p-4 rounded-xl bg-white/10 border border-white/20 text-center"
                  >
                    <div className="text-4xl mb-2">🏆</div>
                    <p className="text-sm font-semibold text-white capitalize">
                      {badgeId.replace(/-/g, " ")}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Key Improvement Tip */}
        {showBadges && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-8"
          >
            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-lg font-semibold text-blue-400 mb-2">Key Improvement:</h4>
                <p className="text-white/80">{keyImprovementTip}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Continue Button */}
        {showBadges && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            onClick={onContinue}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-lg font-bold hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            View Detailed Report
          </motion.button>
        )}
      </div>
    </div>
  );
}
