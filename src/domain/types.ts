export type StudyMode = "random" | "weak" | "unanswered" | "category" | "retry";

export interface Question {
  id: string; // {categoryId}-{sourcePageId}
  source: string;
  sourceUrl: string;
  categoryId: string;
  subcategoryId?: string;
  question: string;
  answer: boolean;
  explanation: string;
  tags: string[];
  active: boolean;
  contentHash: string;
  scrapedAt: string;
  updatedAt?: string;
}

export interface AnswerRecord {
  id: string;
  questionId: string;
  sessionId: string;
  selectedAnswer: boolean;
  correctAnswer: boolean;
  isCorrect: boolean;
  answeredAt: string;
  responseTimeMs?: number;
  mode: StudyMode;
}

export type MasteryStatus = "unseen" | "learning" | "review" | "mastered" | "stale";

export interface QuestionProgress {
  questionId: string;
  attempts: number;
  correctCount: number;
  wrongCount: number;
  currentCorrectStreak: number;
  maxCorrectStreak: number;
  lastAnswerCorrect?: boolean;
  lastAnsweredAt?: string;
  bookmarked: boolean;
  masteryStatus: MasteryStatus;
}

export interface DailyStudyStat {
  date: string; // YYYY-MM-DD
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  studyTimeMs: number;
  uniqueQuestionCount: number;
}

export interface SessionSettings {
  questionCount: number | "unlimited";
  retryWrongEnabled: boolean;
  autoAdvance: "off" | "correct-only" | "always";
  autoAdvanceSeconds?: number;
  categoryIds?: string[];
}

export interface StudySession {
  id: string;
  mode: StudyMode;
  questionIds: string[];
  currentIndex: number;
  startedAt: string;
  completedAt?: string;
  status: "active" | "completed" | "abandoned";
  settings: SessionSettings;
}

export interface AppSettings {
  defaultQuestionCount: number;
  retryWrongEnabled: boolean;
  autoAdvance: "off" | "correct-only" | "always";
  autoAdvanceSeconds: number;
  darkMode: "system" | "light" | "dark";
  fontSize: "standard" | "large";
  vibration: boolean;
  soundEffect: boolean;
  passphraseRemembered: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultQuestionCount: 30,
  retryWrongEnabled: true,
  autoAdvance: "off",
  autoAdvanceSeconds: 3,
  darkMode: "system",
  fontSize: "standard",
  vibration: true,
  soundEffect: false,
  passphraseRemembered: false,
};
