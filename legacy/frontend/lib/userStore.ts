import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from 'firebase/auth';
import { UserProfile } from './firestore';

interface UserState {
  // Auth state
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  
  // Gamification actions
  addXP: (amount: number) => void;
  incrementInterviews: () => void;
  updateScore: (score: number) => void;
  addBadge: (badge: string) => void;
  updateStreak: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: true,
      
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        isLoading: false 
      }),
      
      setProfile: (profile) => set({ profile }),
      
      updateProfile: (updates) => set((state) => ({
        profile: state.profile ? { ...state.profile, ...updates } : null
      })),
      
      clearUser: () => set({ 
        user: null, 
        profile: null, 
        isAuthenticated: false 
      }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      addXP: (amount) => set((state) => {
        if (!state.profile) return state;
        
        const newXP = state.profile.totalXP + amount;
        const newLevel = Math.floor(newXP / 1000) + 1; // 1000 XP per level
        
        return {
          profile: {
            ...state.profile,
            totalXP: newXP,
            currentLevel: newLevel
          }
        };
      }),
      
      incrementInterviews: () => set((state) => {
        if (!state.profile) return state;
        
        return {
          profile: {
            ...state.profile,
            totalInterviews: state.profile.totalInterviews + 1
          }
        };
      }),
      
      updateScore: (score) => set((state) => {
        if (!state.profile) return state;
        
        const totalInterviews = state.profile.totalInterviews;
        const currentAvg = state.profile.averageScore;
        const newAvg = ((currentAvg * totalInterviews) + score) / (totalInterviews + 1);
        
        return {
          profile: {
            ...state.profile,
            averageScore: Math.round(newAvg)
          }
        };
      }),
      
      addBadge: (badge) => set((state) => {
        if (!state.profile || state.profile.badges.includes(badge)) return state;
        
        return {
          profile: {
            ...state.profile,
            badges: [...state.profile.badges, badge]
          }
        };
      }),
      
      updateStreak: () => set((state) => {
        if (!state.profile) return state;
        
        const today = new Date().toISOString().split('T')[0];
        const lastDate = state.profile.lastInterviewDate;
        
        let newStreak = state.profile.streak;
        
        if (lastDate) {
          const lastDateObj = new Date(lastDate);
          const todayObj = new Date(today);
          const diffDays = Math.floor((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            // Consecutive day
            newStreak += 1;
          } else if (diffDays > 1) {
            // Streak broken
            newStreak = 1;
          }
          // If same day, keep streak
        } else {
          // First interview
          newStreak = 1;
        }
        
        return {
          profile: {
            ...state.profile,
            streak: newStreak,
            lastInterviewDate: today
          }
        };
      })
    }),
    {
      name: 'blackbox-user-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user ? {
          uid: state.user.uid,
          email: state.user.email,
          displayName: state.user.displayName,
          photoURL: state.user.photoURL
        } : null,
        profile: state.profile,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
