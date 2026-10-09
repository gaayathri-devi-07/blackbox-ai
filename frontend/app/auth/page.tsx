"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/lib/userStore";
import { updateUserProfile } from "@/lib/firestore";
import { ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

const careerPaths = [
  { id: "software", label: "Software Engineering", icon: "💻" },
  { id: "data", label: "Data Science", icon: "📊" },
  { id: "product", label: "Product Management", icon: "📱" },
  { id: "design", label: "UX/UI Design", icon: "🎨" },
  { id: "marketing", label: "Digital Marketing", icon: "📈" },
  { id: "business", label: "Business Analytics", icon: "💼" },
];

const domains = [
  "Frontend Development",
  "Backend Development",
  "Full Stack Development",
  "Mobile Development",
  "Machine Learning",
  "Data Engineering",
  "DevOps",
  "Cloud Computing",
  "Cybersecurity",
  "Product Strategy",
  "Marketing Strategy",
  "Other",
];

const experienceLevels = [
  { id: "fresher", label: "Fresher (0-1 years)", icon: "🌱" },
  { id: "junior", label: "Junior (1-3 years)", icon: "🚀" },
  { id: "mid", label: "Mid-Level (3-5 years)", icon: "⭐" },
  { id: "senior", label: "Senior (5+ years)", icon: "🏆" },
];

export default function AuthPage() {
  const router = useRouter();
  const { profile, updateProfile, isLoading } = useUserStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    careerPath: "",
    domain: "",
    experienceLevel: "",
  });

  useEffect(() => {
    // Redirect if not authenticated
    if (!isLoading && !profile) {
      router.push("/landing");
    }
    // Redirect if already completed onboarding
    if (profile?.onboardingComplete) {
      router.push("/home");
    }
  }, [profile, isLoading, router]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleComplete = async () => {
    if (!profile || !formData.careerPath || !formData.domain || !formData.experienceLevel) {
      return;
    }

    setLoading(true);

    try {
      // Update Firestore
      await updateUserProfile(profile.uid, {
        careerPath: formData.careerPath,
        domain: formData.domain,
        experienceLevel: formData.experienceLevel,
        onboardingComplete: true,
      });

      // Update Zustand store
      updateProfile({
        careerPath: formData.careerPath,
        domain: formData.domain,
        experienceLevel: formData.experienceLevel,
        onboardingComplete: true,
      });

      // Navigate to home
      router.push("/home");
    } catch (error) {
      console.error("Failed to update profile:", error);
      setLoading(false);
    }
  };

  const isStepValid = () => {
    if (step === 1) return !!formData.careerPath;
    if (step === 2) return !!formData.domain;
    if (step === 3) return !!formData.experienceLevel;
    return false;
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center transition-colors duration-300">
        <div className="text-slate-900 dark:text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black relative overflow-hidden flex items-center justify-center px-4 transition-colors duration-300">
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/30 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-purple-300 font-medium">Step {step} of 3</span>
            <span className="text-sm text-purple-300 font-medium">{Math.round((step / 3) * 100)}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Content Card */}
        <motion.div
          className="bg-gradient-to-br from-[#0A0A0F] to-[#1A0A2F] border border-purple-500/20 rounded-3xl p-8 md:p-12 shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Career Path */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-3">
                  Choose Your Career Path
                </h2>
                <p className="text-purple-200/60 mb-8">
                  Select the field you're pursuing or currently working in
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {careerPaths.map((career) => (
                    <motion.button
                      key={career.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFormData({ ...formData, careerPath: career.id })}
                      className={`p-6 rounded-2xl border-2 transition-all duration-200 text-left ${
                        formData.careerPath === career.id
                          ? "border-purple-500 bg-purple-500/20"
                          : "border-white/10 bg-white/5 hover:border-purple-500/50"
                      }`}
                    >
                      <div className="text-4xl mb-3">{career.icon}</div>
                      <div className="text-slate-900 dark:text-white font-semibold">{career.label}</div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Domain */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-3">
                  What's Your Domain?
                </h2>
                <p className="text-purple-200/60 mb-8">
                  Select your specific area of expertise or interest
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {domains.map((domain) => (
                    <motion.button
                      key={domain}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFormData({ ...formData, domain })}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        formData.domain === domain
                          ? "border-purple-500 bg-purple-500/20"
                          : "border-white/10 bg-white/5 hover:border-purple-500/50"
                      }`}
                    >
                      <div className="text-slate-900 dark:text-white font-medium">{domain}</div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Experience Level */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-3">
                  Your Experience Level
                </h2>
                <p className="text-purple-200/60 mb-8">
                  Help us tailor the interview difficulty to your level
                </p>

                <div className="grid grid-cols-1 gap-4">
                  {experienceLevels.map((level) => (
                    <motion.button
                      key={level.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFormData({ ...formData, experienceLevel: level.id })}
                      className={`p-6 rounded-2xl border-2 transition-all duration-200 text-left flex items-center gap-4 ${
                        formData.experienceLevel === level.id
                          ? "border-purple-500 bg-purple-500/20"
                          : "border-white/10 bg-white/5 hover:border-purple-500/50"
                      }`}
                    >
                      <div className="text-4xl">{level.icon}</div>
                      <div className="text-slate-900 dark:text-white font-semibold text-lg">{level.label}</div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-8 border-t border-white/10">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBack}
              disabled={step === 1}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/20 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </motion.button>

            {step < 3 ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNext}
                disabled={!isStepValid()}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleComplete}
                disabled={!isStepValid() || loading}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                {loading ? "Completing..." : "Complete"}
                <Sparkles className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Skip button */}
        <button
          onClick={() => router.push("/home")}
          className="mt-6 w-full text-center text-purple-200/60 hover:text-purple-200 transition-colors text-sm"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
