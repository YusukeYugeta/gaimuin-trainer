import type { AnswerRecord, MasteryStatus, QuestionProgress } from "./types";

const STALE_DAYS = 30;
const MASTERED_STREAK = 3;
const MASTERED_ACCURACY = 0.8;
const REVIEW_ACCURACY = 0.7;

interface MasteryInput {
  attempts: number;
  correctCount: number;
  currentCorrectStreak: number;
  lastAnswerCorrect?: boolean;
  lastAnsweredAt?: string;
}

export function computeMasteryStatus(input: MasteryInput, now: Date = new Date()): MasteryStatus {
  if (input.attempts === 0) return "unseen";
  const accuracy = input.correctCount / input.attempts;
  const isMastered = input.currentCorrectStreak >= MASTERED_STREAK && accuracy >= MASTERED_ACCURACY;
  if (isMastered) {
    if (input.lastAnsweredAt) {
      const days = (now.getTime() - new Date(input.lastAnsweredAt).getTime()) / 86_400_000;
      if (days >= STALE_DAYS) return "stale";
    }
    return "mastered";
  }
  if (input.lastAnswerCorrect === false || accuracy < REVIEW_ACCURACY) return "review";
  return "learning";
}

// AnswerRecordから派生データを再生成する。answerRecordsは追記型・非破壊のため、
// questionProgressはいつでもこの関数で再構築できる。
export function recomputeProgress(
  questionId: string,
  records: AnswerRecord[],
  bookmarked: boolean,
  now: Date = new Date(),
): QuestionProgress {
  const sorted = [...records].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
  let correctCount = 0;
  let wrongCount = 0;
  let currentCorrectStreak = 0;
  let maxCorrectStreak = 0;
  let lastAnswerCorrect: boolean | undefined;
  let lastAnsweredAt: string | undefined;

  for (const record of sorted) {
    if (record.isCorrect) {
      correctCount++;
      currentCorrectStreak++;
      maxCorrectStreak = Math.max(maxCorrectStreak, currentCorrectStreak);
    } else {
      wrongCount++;
      currentCorrectStreak = 0;
    }
    lastAnswerCorrect = record.isCorrect;
    lastAnsweredAt = record.answeredAt;
  }

  const attempts = sorted.length;
  const masteryStatus = computeMasteryStatus(
    { attempts, correctCount, currentCorrectStreak, lastAnswerCorrect, lastAnsweredAt },
    now,
  );

  return {
    questionId,
    attempts,
    correctCount,
    wrongCount,
    currentCorrectStreak,
    maxCorrectStreak,
    lastAnswerCorrect,
    lastAnsweredAt,
    bookmarked,
    masteryStatus,
  };
}

export function isWeakQuestion(progress: QuestionProgress | undefined): boolean {
  if (!progress) return false;
  const accuracy = progress.attempts > 0 ? progress.correctCount / progress.attempts : 1;
  return (
    progress.lastAnswerCorrect === false ||
    accuracy < REVIEW_ACCURACY ||
    progress.wrongCount >= 2 ||
    progress.masteryStatus === "review" ||
    progress.bookmarked
  );
}
