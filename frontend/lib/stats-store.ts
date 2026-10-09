import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const STATS_FILE = path.join(DATA_DIR, "stats.json");

export interface SkillScores {
  communication: number;
  confidence: number;
  technical: number;
  bodyLanguage: number;
  eyeContact: number;
  posture: number;
}

export interface ScoreHistoryEntry {
  session: number;
  score: number;
  date: string;
}

export interface UserStats {
  userId: string;
  interviewCount: number;
  practiceCount: number;
  gdCount: number;
  avgScore: number;
  skillScores: SkillScores;
  scoreHistory: ScoreHistoryEntry[];
  updatedAt: string;
}

type StatsDB = Record<string, UserStats>;

const DEFAULT_SKILL_SCORES: SkillScores = {
  communication: 0,
  confidence: 0,
  technical: 0,
  bodyLanguage: 0,
  eyeContact: 0,
  posture: 0,
};

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDB(): StatsDB {
  ensureDir();
  if (!fs.existsSync(STATS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeDB(db: StatsDB): void {
  ensureDir();
  fs.writeFileSync(STATS_FILE, JSON.stringify(db, null, 2));
}

function makeUser(userId: string): UserStats {
  return {
    userId,
    interviewCount: 0,
    practiceCount: 0,
    gdCount: 0,
    avgScore: 0,
    skillScores: { ...DEFAULT_SKILL_SCORES },
    scoreHistory: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getOrCreateUser(userId: string): UserStats {
  const db = readDB();
  if (!db[userId]) {
    db[userId] = makeUser(userId);
    writeDB(db);
  }
  return db[userId];
}

export function incrementActivity(
  userId: string,
  type: "interview" | "practice" | "gd"
): UserStats {
  const db = readDB();
  const user = db[userId] ?? makeUser(userId);
  if (type === "interview") user.interviewCount += 1;
  else if (type === "practice") user.practiceCount += 1;
  else if (type === "gd") user.gdCount += 1;
  user.updatedAt = new Date().toISOString();
  db[userId] = user;
  writeDB(db);
  return user;
}

export interface InterviewSavePayload {
  userId: string;
  scores: {
    overall: number;
    fluency: number;
    grammar: number;
    vocabulary: number;
    clarity: number;
    confidence: number;
    leadership: number;
    positivity: number;
  };
  eyeContact: number;
}

export function saveInterviewResult(payload: InterviewSavePayload): UserStats {
  const db = readDB();
  const user = db[payload.userId] ?? makeUser(payload.userId);

  // Increment interview count
  user.interviewCount += 1;
  const n = user.interviewCount;

  // Append score history
  user.scoreHistory.push({
    session: n,
    score: payload.scores.overall,
    date: new Date().toISOString().split("T")[0],
  });

  // Recalculate avg score
  user.avgScore = Math.round(
    user.scoreHistory.reduce((sum, s) => sum + s.score, 0) /
      user.scoreHistory.length
  );

  // Rolling average for skill scores
  const prev = user.skillScores;
  user.skillScores = {
    communication: Math.round(
      ((prev.communication * (n - 1)) +
        (payload.scores.fluency + payload.scores.clarity) / 2) /
        n
    ),
    confidence: Math.round(
      ((prev.confidence * (n - 1)) + payload.scores.confidence) / n
    ),
    technical: Math.round(
      ((prev.technical * (n - 1)) +
        (payload.scores.vocabulary + payload.scores.grammar) / 2) /
        n
    ),
    bodyLanguage: Math.round(
      ((prev.bodyLanguage * (n - 1)) + payload.scores.leadership) / n
    ),
    eyeContact: Math.round(
      ((prev.eyeContact * (n - 1)) + payload.eyeContact) / n
    ),
    posture: Math.round(
      ((prev.posture * (n - 1)) + payload.scores.positivity) / n
    ),
  };

  user.updatedAt = new Date().toISOString();
  db[payload.userId] = user;
  writeDB(db);
  return user;
}
