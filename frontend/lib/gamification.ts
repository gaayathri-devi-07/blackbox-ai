// Gamification Logic Engine
import { UserProfile } from "./firestore";

// ============================================================================
// POINT & LEVEL CALCULATION
// ============================================================================

export interface PointsBreakdown {
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
}

export interface LevelInfo {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number;
}

export const LEVEL_THRESHOLDS: LevelInfo[] = [
  { level: 1, name: "Beginner", minPoints: 0, maxPoints: 200 },
  { level: 2, name: "Intermediate", minPoints: 201, maxPoints: 500 },
  { level: 3, name: "Advanced", minPoints: 501, maxPoints: 1000 },
  { level: 4, name: "Interview Ready", minPoints: 1001, maxPoints: Infinity },
];

export function calculatePoints(
  totalInterviews: number,
  totalGD: number,
  latestScore: number
): PointsBreakdown {
  const basePoints = totalInterviews * 50 + totalGD * 50;
  const bonusPoints = Math.round(latestScore * 2);
  const totalPoints = basePoints + bonusPoints;

  return { basePoints, bonusPoints, totalPoints };
}

export function getLevel(points: number): LevelInfo {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i].minPoints) {
      return LEVEL_THRESHOLDS[i];
    }
  }
  return LEVEL_THRESHOLDS[0];
}

export function getNextLevel(currentLevel: number): LevelInfo | null {
  const nextLevelIndex = LEVEL_THRESHOLDS.findIndex((l) => l.level === currentLevel + 1);
  return nextLevelIndex !== -1 ? LEVEL_THRESHOLDS[nextLevelIndex] : null;
}

export function getProgressToNextLevel(points: number): {
  currentLevel: LevelInfo;
  nextLevel: LevelInfo | null;
  pointsToNext: number;
  progressPercent: number;
} {
  const currentLevel = getLevel(points);
  const nextLevel = getNextLevel(currentLevel.level);

  if (!nextLevel) {
    return {
      currentLevel,
      nextLevel: null,
      pointsToNext: 0,
      progressPercent: 100,
    };
  }

  const pointsInCurrentLevel = points - currentLevel.minPoints;
  const pointsNeededForNextLevel = nextLevel.minPoints - currentLevel.minPoints;
  const progressPercent = Math.min(
    100,
    (pointsInCurrentLevel / pointsNeededForNextLevel) * 100
  );

  return {
    currentLevel,
    nextLevel,
    pointsToNext: nextLevel.minPoints - points,
    progressPercent,
  };
}

// ============================================================================
// BADGE SYSTEM
// ============================================================================

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (profile: UserProfile) => boolean;
}

export const BADGES: Badge[] = [
  {
    id: "first-interview",
    name: "First Interview",
    description: "Completed your first mock interview",
    icon: "🎯",
    condition: (profile) => profile.totalInterviews >= 1,
  },
  {
    id: "interview-veteran",
    name: "Interview Veteran",
    description: "Completed 10 mock interviews",
    icon: "🏆",
    condition: (profile) => profile.totalInterviews >= 10,
  },
  {
    id: "gd-expert",
    name: "GD Expert",
    description: "Participated in 5 group discussions",
    icon: "💬",
    condition: (profile) => profile.totalGD >= 5,
  },
  {
    id: "high-performer",
    name: "High Performer",
    description: "Achieved average score above 80%",
    icon: "⭐",
    condition: (profile) => profile.averageScore >= 80,
  },
  {
    id: "consistent-learner",
    name: "Consistent Learner",
    description: "Maintained a 7-day streak",
    icon: "🔥",
    condition: (profile) => profile.streak >= 7,
  },
  {
    id: "interview-master",
    name: "Interview Master",
    description: "Reached Level 4 (Interview Ready)",
    icon: "👑",
    condition: (profile) => profile.currentLevel >= 4,
  },
  {
    id: "perfectionist",
    name: "Perfectionist",
    description: "Scored 95% or higher in an interview",
    icon: "💯",
    condition: (profile) => profile.overallScore >= 95,
  },
  {
    id: "quick-learner",
    name: "Quick Learner",
    description: "Completed 5 interviews in your first week",
    icon: "⚡",
    condition: (profile) => profile.totalInterviews >= 5,
  },
];

export function evaluateBadges(profile: UserProfile): string[] {
  const earnedBadges: string[] = [];
  
  for (const badge of BADGES) {
    if (badge.condition(profile) && !profile.badges.includes(badge.id)) {
      earnedBadges.push(badge.id);
    }
  }
  
  return earnedBadges;
}

export function getBadgeInfo(badgeId: string): Badge | undefined {
  return BADGES.find((b) => b.id === badgeId);
}

// ============================================================================
// GAMIFICATION UPDATE
// ============================================================================

export interface GamificationUpdate {
  pointsEarned: number;
  newTotalPoints: number;
  leveledUp: boolean;
  newLevel: number;
  newBadges: string[];
  improvementHubUnlocked: boolean;
}

export function calculateGamificationUpdate(
  currentProfile: UserProfile,
  sessionScore: number,
  sessionType: "interview" | "gd"
): GamificationUpdate {
  // Calculate new totals
  const newTotalInterviews =
    sessionType === "interview"
      ? currentProfile.totalInterviews + 1
      : currentProfile.totalInterviews;
  const newTotalGD =
    sessionType === "gd" ? currentProfile.totalGD + 1 : currentProfile.totalGD;

  // Calculate new average score
  const totalSessions = newTotalInterviews + newTotalGD;
  const previousTotal =
    currentProfile.averageScore * (currentProfile.totalInterviews + currentProfile.totalGD);
  const newAverageScore = (previousTotal + sessionScore) / totalSessions;

  // Calculate points
  const oldPoints = currentProfile.points;
  const pointsBreakdown = calculatePoints(newTotalInterviews, newTotalGD, sessionScore);
  const newTotalPoints = pointsBreakdown.totalPoints;
  const pointsEarned = newTotalPoints - oldPoints;

  // Check level up
  const oldLevel = getLevel(oldPoints);
  const newLevel = getLevel(newTotalPoints);
  const leveledUp = newLevel.level > oldLevel.level;

  // Check if Improvement Hub should be unlocked (after 3 total interviews)
  const shouldUnlockHub = 
    !currentProfile.improvementHubUnlocked && 
    (newTotalInterviews >= 3);

  // Check new badges
  const updatedProfile: UserProfile = {
    ...currentProfile,
    totalInterviews: newTotalInterviews,
    totalGD: newTotalGD,
    averageScore: newAverageScore,
    points: newTotalPoints,
    overallScore: sessionScore,
    currentLevel: newLevel.level,
  };
  const newBadges = evaluateBadges(updatedProfile);

  return {
    pointsEarned,
    newTotalPoints,
    leveledUp,
    newLevel: newLevel.level,
    newBadges,
    improvementHubUnlocked: shouldUnlockHub,
  };
}
