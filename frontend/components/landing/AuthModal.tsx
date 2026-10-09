"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { signInWithGoogle, signInWithGithub, setupRecaptcha, sendPhoneVerification, verifyPhoneCode } from "@/lib/firebase";
import { getOrCreateUserProfile, updateUserProfile } from "@/lib/firestore";
import { useUserStore } from "@/lib/userStore";
import { useState } from "react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter();
  const { setUser, setProfile, setLoading: setGlobalLoading } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneMode, setPhoneMode] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const handleAuthSuccess = async (user: any) => {
    try {
      // Get or create user profile in Firestore
      const profile = await getOrCreateUserProfile(
        user.uid,
        user.email || user.phoneNumber || "",
        user.displayName || "User",
        user.photoURL,
        user.phoneNumber
      );

      // Update Zustand store
      setUser(user);
      setProfile(profile);
      setGlobalLoading(false);

      // Show success message in console (toast library not installed yet)
      console.log("✅ Welcome back!", `Signed in as ${profile.displayName || profile.email}`);

      // ROUTING LOGIC: Always check onboarding status
      // Priority: companionId > careerPath > onboardingComplete
      
      if (!profile.companionId) {
        // User hasn't selected companion yet - redirect to companion page
        console.log("Redirecting to companion selection...");
        router.push("/companion");
      } else if (!profile.careerPath) {
        // Has companion but no career - redirect to career page
        console.log("Redirecting to career selection...");
        router.push("/career");
      } else if (!profile.onboardingComplete) {
        // Has both but onboarding not marked complete - complete it and go to journey
        console.log("Completing onboarding...");
        await updateUserProfile(user.uid, { onboardingComplete: true });
        router.push("/journey");
      } else {
        // Everything done - go to journey
        console.log("Onboarding complete, redirecting to journey...");
        router.push("/journey");
      }

      onClose();
    } catch (firestoreError: any) {
      console.error("Firestore error:", firestoreError);
      setError("Failed to load profile. Please check your internet connection.");
      console.error("❌ Authentication failed: Could not load your profile. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    
    const { user, error: authError } = await signInWithGoogle();
    
    if (authError || !user) {
      setError(authError || "Failed to sign in. Please try again.");
      console.error("❌ Authentication failed", authError || "Could not sign in with Google");
      setLoading(false);
      return;
    }

    await handleAuthSuccess(user);
  };

  const handleGithubSignIn = async () => {
    setLoading(true);
    setError(null);
    
    const { user, error: authError } = await signInWithGithub();
    
    if (authError || !user) {
      setError(authError || "Failed to sign in with GitHub. Please try again.");
      console.error("❌ Authentication failed", authError || "Could not sign in with GitHub");
      setLoading(false);
      return;
    }

    await handleAuthSuccess(user);
  };

  const handlePhoneSignIn = async () => {
    if (!phoneNumber) {
      setError("Please enter a phone number");
      console.warn("⚠️ Phone number required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const recaptchaVerifier = setupRecaptcha("recaptcha-container");
      if (!recaptchaVerifier) {
        throw new Error("Failed to setup reCAPTCHA");
      }

      const { confirmationResult: result, error: authError } = await sendPhoneVerification(
        phoneNumber,
        recaptchaVerifier
      );

      if (authError || !result) {
        setError("Failed to send verification code. Please try again.");
        console.error("❌ SMS failed: Could not send verification code");
        setLoading(false);
        return;
      }

      setConfirmationResult(result);
      console.log("✅ Code sent! Check your phone for the verification code");
      setLoading(false);
    } catch (err) {
      setError("Failed to send verification code. Please try again.");
      console.error("❌ SMS failed");
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || !confirmationResult) return;

    setLoading(true);
    setError(null);

    const { user, error: authError } = await verifyPhoneCode(confirmationResult, verificationCode);

    if (authError || !user) {
      setError("Invalid verification code. Please try again.");
      console.error("❌ Invalid code: Please check your code and try again");
      setLoading(false);
      return;
    }

    await handleAuthSuccess(user);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              className="relative w-full max-w-md bg-gradient-to-br from-[#0A0A0F] to-[#1A0A2F] border border-purple-500/20 rounded-3xl p-8 shadow-2xl shadow-purple-900/20"
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{
                backdropFilter: "blur(20px)",
                boxShadow: "0 0 80px rgba(124, 58, 237, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.05) inset"
              }}
            >
              {/* Decorative glow */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />

              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-all duration-200 group"
              >
                <X className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
              </button>

              <div className="text-center mb-8 relative z-10">
                
                {/* NEW GLOWING AI LOGO */}
                <div className="flex justify-center mb-6">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.4)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/20 rounded-2xl blur-md"></div>
                    <Sparkles className="w-8 h-8 text-white relative z-10 animate-pulse" />
                  </div>
                </div>
                
                <h2 className="text-3xl font-black text-white mb-2 tracking-tight bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                  Welcome Back
                </h2>
                <p className="text-purple-200/60 text-sm">
                  Sign in to continue your interview journey
                </p>
                {error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm mt-3 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              {!phoneMode ? (
                <div className="space-y-3 relative z-10">
                  {/* Google Sign In */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-white/95 text-black font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </motion.button>

                  {/* GitHub Sign In */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGithubSignIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl border border-white/20 backdrop-blur-sm transition-all duration-200 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    Continue with GitHub
                  </motion.button>

                  {/* Phone Sign In Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setPhoneMode(true)}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl border border-white/20 backdrop-blur-sm transition-all duration-200"
                  >
                    📱 Continue with Phone
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-4">
                  {!confirmationResult ? (
                    <>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 234 567 8900"
                        className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      />
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handlePhoneSignIn}
                        disabled={loading}
                        className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold transition-all disabled:opacity-50 shadow-lg shadow-purple-500/30"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Send Code"}
                      </motion.button>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="000000"
                        maxLength={6}
                        className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-center text-3xl tracking-[0.5em] font-bold transition-all"
                      />
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleVerifyCode}
                        disabled={loading}
                        className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold transition-all disabled:opacity-50 shadow-lg shadow-purple-500/30"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Verify & Continue"}
                      </motion.button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setPhoneMode(false);
                      setPhoneNumber("");
                      setVerificationCode("");
                      setConfirmationResult(null);
                      setError(null);
                    }}
                    className="w-full text-purple-200/60 hover:text-white text-sm transition-colors font-medium"
                  >
                    ← Back to other options
                  </button>
                </div>
              )}

              <div id="recaptcha-container" className="mt-4"></div>

              {/* Terms */}
              <p className="text-xs text-purple-200/40 text-center mt-8">
                By signing in, you agree to our{" "}
                <a href="#" className="text-purple-400 hover:text-purple-300 transition-colors underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-purple-400 hover:text-purple-300 transition-colors underline">
                  Privacy Policy
                </a>
              </p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
