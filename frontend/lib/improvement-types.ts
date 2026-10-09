import { Timestamp } from "firebase/firestore";

export interface ImprovementPlan {
  userId: string;
  weakestArea: string;
  mistakes: string[];
  skillFeedback: {
    technical: { score: number; notes: string };
    communication: { score: number; notes: string };
    behavioral: { score: number; notes: string };
  };
  weeklyRoadmap: WeekPlan[];
  recommendedActions: RecommendedAction[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WeekPlan {
  week: number;
  title: string;
  goals: string[];
  exercises: string[];
  resources: string[];
}

export interface RecommendedAction {
  title: string;
  description: string;
  link: string;
  priority: "high" | "medium" | "low";
  icon: string;
}

export interface SessionRecording {
  sessionId: string;
  userId: string;
  blobUrl: string;
  duration: number;
  type: "interview" | "gd";
  createdAt: Timestamp;
}
