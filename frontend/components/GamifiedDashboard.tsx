"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Star, Target, TrendingUp, Award, Lock } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserProfile, UserProfile } from "@/lib/firestore";
import { getProgressToNextLevel, BADGES, getBadgeInfo } from "@/lib/gamification";

export default function GamifiedDashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userProfile = await getUserProfile(currentUser.uid);
        setProfile(userProfile);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-white">No profile found</div>
      </div>
    );
  }

  const progressData = getProgressToNextLevel(profile.points);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black mb-2">Dashboard</h1>
          <p className="text-white/60">Welcome back, {profile.displayName}!</p>
        </div>

        {/* Level Badge Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 p-8 rounded-3xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/30 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-3xl font-black shadow-lg shadow-yellow-500/30">
                  {progressData.currentLevel.level}
                </div>
                <div>
                  <h2 className="text-3xl font-black">{progressData.currentLevel.name}</h2>
                  <p className="text-white/60">Level {progressData.currentLevel.level}</p>
                </div>
              </div>

              {/* Progress to Next Level */}
              {progressData.nextLevel && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/60">
                      {profile.points} / {progressData.nextLevel.minPoints} points
                    </span>
                    <span className="text-sm text-white/60">
                      {progressData.pointsToNext} to Level {progressData.nextLevel.level}
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressData.progressPercent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="text-right">
              <div className="text-5xl font-black mb-2">{profile.points}</div>
              <div className="text-white/60">Total Points</div>
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: Target,
              label: "Total Interviews",
              value: profile.totalInterviews,
              color: "from-blue-600 to-cyan-600",
            },
            {
              icon: TrendingUp,
              label: "GD Rounds",
              value: profile.totalGD,
              color: "from-purple-600 to-pink-600",
            },
            {
              icon: Star,
              label: "Avg Score",
              value: `${profile.averageScore.toFixed(1)}%`,
              color: "from-yellow-500 to-orange-500",
            },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * idx }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-3xl font-black">{stat.value}</div>
                </div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Badges Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Award className="w-7 h-7" />
            Badges
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {BADGES.map((badge) => {
              const isUnlocked = profile.badges.includes(badge.id);
              const badgeInfo = getBadgeInfo(badge.id);

              return (
                <motion.div
                  key={badge.id}
                  whileHover={isUnlocked ? { scale: 1.05 } : {}}
                  className={`p-6 rounded-2xl border-2 text-center transition-all ${
                    isUnlocked
                      ? "bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/30"
                      : "bg-white/5 border-white/10 opacity-40 grayscale"
                  }`}
                >
                  <div className="text-5xl mb-3">{badge.icon}</div>
                  <div className="font-bold text-sm mb-1">{badge.name}</div>
                  <div className="text-xs text-white/50">{badge.description}</div>
                  {!isUnlocked && (
                    <div className="mt-2">
                      <Lock className="w-4 h-4 mx-auto text-white/30" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button className="p-6 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 text-left hover:shadow-lg hover:shadow-purple-500/30 transition-all">
            <div className="text-2xl font-bold mb-2">Start Mock Interview</div>
            <div className="text-white/80 text-sm">
              Practice with AI interviewers from top companies
            </div>
          </button>
          
          <button className="p-6 rounded-2xl bg-gradient-to-br from-pink-600 to-red-600 text-left hover:shadow-lg hover:shadow-pink-500/30 transition-all">
            <div className="text-2xl font-bold mb-2">Join GD Simulator</div>
            <div className="text-white/80 text-sm">
              7-member group discussion with AI participants
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
