'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/lib/userStore';
import { updateUserProfile } from '@/lib/firestore';
import { Sparkles } from 'lucide-react';

const companions = [
  {
    id: 'luna',
    name: 'Luna',
    avatar: '🌙',
    personality: 'Empathetic & Supportive',
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'nova',
    name: 'Nova',
    avatar: '⭐',
    personality: 'Dynamic & Energetic',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    id: 'stella',
    name: 'Stella',
    avatar: '✨',
    personality: 'Professional & Sharp',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'orion',
    name: 'Orion',
    avatar: '🌟',
    personality: 'Analytical & Precise',
    color: 'from-green-500 to-teal-500',
  },
  {
    id: 'cosmo',
    name: 'Cosmo',
    avatar: '🚀',
    personality: 'Creative & Innovative',
    color: 'from-red-500 to-pink-500',
  },
];

export default function CompanionSelector() {
  const { profile, setProfile } = useUserStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentCompanion = companions.find(c => c.id === profile?.companionId) || companions[0];

  const handleSelectCompanion = async (companionId: string) => {
    if (!profile?.uid || isUpdating) return;

    setIsUpdating(true);
    try {
      await updateUserProfile(profile.uid, { companionId });
      setProfile({ ...profile, companionId });
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update companion:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 hover:scale-105"
      >
        <span className="text-2xl">{currentCompanion.avatar}</span>
        <div className="flex flex-col items-start">
          <span className="text-xs text-white/60">AI Companion</span>
          <span className="text-sm font-medium text-white">{currentCompanion.name}</span>
        </div>
        <Sparkles className="w-4 h-4 text-purple-400 ml-2" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            />

            {/* Dropdown - FIXED positioning to escape sidebar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed left-72 top-24 w-80 bg-[#0a0a0a] border border-white/20 rounded-xl shadow-2xl z-[9999] overflow-hidden"
            >
              <div className="p-4 border-b border-white/10">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Choose Your AI Companion
                </h3>
                <p className="text-white/60 text-xs mt-1">
                  Select the AI personality that matches your style
                </p>
              </div>

              <div className="p-2 max-h-[400px] overflow-y-auto">
                {companions.map((companion) => (
                  <motion.button
                    key={companion.id}
                    onClick={() => handleSelectCompanion(companion.id)}
                    disabled={isUpdating}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full p-3 rounded-lg mb-2 transition-all duration-200 ${
                      companion.id === profile?.companionId
                        ? 'bg-gradient-to-r ' + companion.color + ' text-white'
                        : 'bg-white/5 hover:bg-white/10 text-white/90'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{companion.avatar}</span>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{companion.name}</div>
                        <div className={`text-xs ${
                          companion.id === profile?.companionId ? 'text-white/90' : 'text-white/60'
                        }`}>
                          {companion.personality}
                        </div>
                      </div>
                      {companion.id === profile?.companionId && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full bg-white flex items-center justify-center"
                        >
                          <span className="text-purple-600 text-sm">✓</span>
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
