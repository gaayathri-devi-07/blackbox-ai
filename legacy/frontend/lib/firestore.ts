// Firestore Utility Functions
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

// ============================================================================
// USER PROFILES
// ============================================================================

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  
  // Onboarding & Career Info
  careerPath?: string;
  domain?: string;
  experienceLevel?: string;
  careerTrack?: string;
  companionId?: string;
  
  // Interview Preferences
  company?: string;
  interviewStyle?: string;
  voicePreference?: string;
  resumeURL?: string;
  resumeText?: string;
  
  // Gamification & Progress
  overallScore: number;
  currentLevel: number;
  totalInterviews: number;
  totalMocksAttended?: number;
  totalGD: number;
  averageScore: number;
  points: number;
  badges: string[];
  streak: number;
  totalXP: number;
  lastInterviewDate?: string;
  
  // Features
  improvementHubUnlocked: boolean;
  onboardingComplete: boolean;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLogin: Timestamp;
}

export async function createUserProfile(
  uid: string, 
  email: string, 
  displayName: string,
  photoURL?: string,
  phoneNumber?: string
) {
  const userRef = doc(db, "users", uid);
  const userData: Partial<UserProfile> = {
    uid,
    email,
    displayName,
    photoURL: photoURL || "",
    phoneNumber: phoneNumber || "",
    careerTrack: "",
    companionId: "",
    overallScore: 0,
    currentLevel: 1,
    totalInterviews: 0,
    totalMocksAttended: 0,
    totalGD: 0,
    averageScore: 0,
    points: 0,
    totalXP: 0,
    badges: [],
    streak: 0,
    improvementHubUnlocked: false,
    onboardingComplete: false,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    lastLogin: serverTimestamp() as Timestamp,
  };
  await setDoc(userRef, userData, { merge: true });
  return userData;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function updateLastLogin(uid: string) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    lastLogin: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getOrCreateUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL?: string,
  phoneNumber?: string
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);
  
  if (existing) {
    // Update last login
    await updateLastLogin(uid);
    return existing;
  }
  
  // Create new profile
  return await createUserProfile(uid, email, displayName, photoURL, phoneNumber) as UserProfile;
}

// ============================================================================
// INTERVIEW TRANSCRIPTS & SCORES
// ============================================================================

export interface InterviewSession {
  id?: string;
  userId: string;
  date: Timestamp;
  companyStyle: string;
  role: string;
  experience: string;
  mode: string;
  resumeText?: string;
  transcript: Array<{ role: string; content: string; timestamp?: number }>;
  communicationScore: number;
  technicalScore: number;
  bodyLanguageScore: number;
  overallScore: number;
  feedback: {
    strengths: string[];
    improvements: string[];
    idealAnswers: Record<string, string>;
  };
  duration: number;
  eyeContactScore?: number;
  createdAt: Timestamp;
}

export async function saveInterviewSession(sessionData: Omit<InterviewSession, "id" | "createdAt">) {
  const interviewsRef = collection(db, "interviews");
  const docRef = await addDoc(interviewsRef, {
    ...sessionData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getInterviewSession(sessionId: string): Promise<InterviewSession | null> {
  const sessionRef = doc(db, "interviews", sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (sessionSnap.exists()) {
    return { id: sessionSnap.id, ...sessionSnap.data() } as InterviewSession;
  }
  return null;
}

export async function getUserInterviews(userId: string, limitCount = 10) {
  const interviewsRef = collection(db, "interviews");
  const q = query(
    interviewsRef,
    where("userId", "==", userId),
    orderBy("date", "desc"),
    limit(limitCount)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as InterviewSession));
}

// ============================================================================
// GROUP DISCUSSION SESSIONS
// ============================================================================

export interface GDSession {
  id?: string;
  userId: string;
  topic: string;
  date: Timestamp;
  participants: Array<{ id: string; name: string; isAI: boolean }>;
  transcript: Array<{
    speakerId: string;
    speakerName: string;
    message: string;
    timestamp: number;
    handRaised?: boolean;
  }>;
  userContributions: number;
  evaluationScore: number;
  feedback: {
    clarity: number;
    relevance: number;
    assertiveness: number;
    listening: number;
    suggestions: string[];
  };
  duration: number;
  createdAt: Timestamp;
}

export async function saveGDSession(sessionData: Omit<GDSession, "id" | "createdAt">) {
  const gdRef = collection(db, "gd_sessions");
  const docRef = await addDoc(gdRef, {
    ...sessionData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getGDSession(sessionId: string): Promise<GDSession | null> {
  const sessionRef = doc(db, "gd_sessions", sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (sessionSnap.exists()) {
    return { id: sessionSnap.id, ...sessionSnap.data() } as GDSession;
  }
  return null;
}

export async function getUserGDSessions(userId: string, limitCount = 10) {
  const gdRef = collection(db, "gd_sessions");
  const q = query(gdRef, where("userId", "==", userId), orderBy("date", "desc"), limit(limitCount));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as GDSession));
}

// ============================================================================
// PRACTICE PROGRESS
// ============================================================================

export interface PracticeProgress {
  userId: string;
  career: string;
  category: string;
  completedQuestions: string[];
  starsEarned: number;
  lastPracticed: Timestamp;
  updatedAt: Timestamp;
}

export async function getPracticeProgress(
  userId: string,
  career: string,
  category: string
): Promise<PracticeProgress | null> {
  const progressRef = doc(db, "practice_progress", `${userId}_${career}_${category}`);
  const progressSnap = await getDoc(progressRef);
  if (progressSnap.exists()) {
    return progressSnap.data() as PracticeProgress;
  }
  return null;
}

export async function updatePracticeProgress(
  userId: string,
  career: string,
  category: string,
  completedQuestion: string,
  stars: number
) {
  const progressRef = doc(db, "practice_progress", `${userId}_${career}_${category}`);
  const existing = await getDoc(progressRef);

  if (existing.exists()) {
    const data = existing.data() as PracticeProgress;
    await updateDoc(progressRef, {
      completedQuestions: [...new Set([...data.completedQuestions, completedQuestion])],
      starsEarned: data.starsEarned + stars,
      lastPracticed: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(progressRef, {
      userId,
      career,
      category,
      completedQuestions: [completedQuestion],
      starsEarned: stars,
      lastPracticed: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

// ============================================
// IMPROVEMENT PLANS (AI COACH SYSTEM)
// ============================================

import { ImprovementPlan } from "./improvement-types";

export async function saveImprovementPlan(userId: string, plan: Omit<ImprovementPlan, "userId" | "createdAt" | "updatedAt">) {
  const planRef = doc(db, "improvement_plans", userId);
  await setDoc(planRef, {
    ...plan,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getImprovementPlan(userId: string): Promise<ImprovementPlan | null> {
  const planRef = doc(db, "improvement_plans", userId);
  const snapshot = await getDoc(planRef);
  return snapshot.exists() ? (snapshot.data() as ImprovementPlan) : null;
}
