"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, User, Briefcase, Mic, FileText, Save } from "lucide-react";
import { useUserStore } from "@/lib/userStore";
import { updateUserProfile } from "@/lib/firestore";
import { ThemeToggle } from "./ThemeToggle";

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const careerPaths = [
  "Software Engineering",
  "Data Science",
  "Product Management",
  "UX/UI Design",
  "Digital Marketing",
  "Business Analytics",
];

const voicePreferences = [
  "Male - Professional",
  "Female - Professional",
  "Male - Friendly",
  "Female - Friendly",
];

const interviewStyles = [
  "Standard",
  "Behavioral Focus",
  "Technical Deep Dive",
  "Mixed Approach",
];

export default function SettingsMenu({ isOpen, onClose }: SettingsMenuProps) {
  const { profile, updateProfile } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    careerPath: profile?.careerPath || "",
    domain: profile?.domain || "",
    experienceLevel: profile?.experienceLevel || "",
    voicePreference: profile?.voicePreference || "Female - Professional",
    interviewStyle: profile?.interviewStyle || "Standard",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        careerPath: profile.careerPath || "",
        domain: profile.domain || "",
        experienceLevel: profile.experienceLevel || "",
        voicePreference: profile.voicePreference || "Female - Professional",
        interviewStyle: profile.interviewStyle || "Standard",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Update Firestore
      await updateUserProfile(profile.uid, formData);

      // Update Zustand
      updateProfile(formData);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Failed to update settings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Settings Panel */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-md bg-gradient-to-br from-[#0A0A0F] to-[#1A0A2F] border-l border-purple-500/20 z-[9999] overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-br from-[#0A0A0F] to-[#1A0A2F] border-b border-white/10 p-6 flex items-center justify-between backdrop-blur-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Settings</h2>
                  <p className="text-sm text-purple-200/60">Customize your experience</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Theme Toggle */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-purple-200">
                  <Settings className="w-4 h-4" />
                  Appearance
                </label>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white">Theme</span>
                  <ThemeToggle />
                </div>
              </div>

              {/* Profile Section */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-purple-200">
                  <User className="w-4 h-4" />
                  Profile Information
                </label>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Career Path</label>
                    <select
                      value={formData.careerPath}
                      onChange={(e) => setFormData({ ...formData, careerPath: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    >
                      <option value="">Select career path</option>
                      {careerPaths.map((path) => (
                        <option key={path} value={path.toLowerCase().replace(/ /g, '-')}>
                          {path}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-white/60 mb-2">Domain</label>
                    <input
                      type="text"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      placeholder="e.g., Full Stack Development"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/60 mb-2">Experience Level</label>
                    <select
                      value={formData.experienceLevel}
                      onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    >
                      <option value="">Select experience</option>
                      <option value="fresher">Fresher (0-1 years)</option>
                      <option value="junior">Junior (1-3 years)</option>
                      <option value="mid">Mid-Level (3-5 years)</option>
                      <option value="senior">Senior (5+ years)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* AI Preferences */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-purple-200">
                  <Mic className="w-4 h-4" />
                  AI Preferences
                </label>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Voice Preference</label>
                    <select
                      value={formData.voicePreference}
                      onChange={(e) => setFormData({ ...formData, voicePreference: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    >
                      {voicePreferences.map((voice) => (
                        <option key={voice} value={voice}>
                          {voice}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-white/60 mb-2">Interview Style</label>
                    <select
                      value={formData.interviewStyle}
                      onChange={(e) => setFormData({ ...formData, interviewStyle: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    >
                      {interviewStyles.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={loading || success}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold transition-all ${
                  success
                    ? "bg-green-500 text-white"
                    : "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg hover:shadow-purple-500/50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : success ? (
                  <>
                    ✓ Saved Successfully!
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
