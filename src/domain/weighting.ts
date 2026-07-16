import type { QuestionProgress } from "./types";

// §7 出題アルゴリズムの重み表
const W = {
  unseenMastery: 1.5,
  recentWrongError: 3.0,
  lowAccuracyMastery: 2.0,
  streak2Mastery: 0.8,
  streak4Mastery: 0.4,
  stale30Recency: 2.0,
  stale7Recency: 1.3,
};

function masteryWeight(progress?: QuestionProgress): number {
  if (!progress || progress.attempts === 0) return W.unseenMastery;
  const accuracy = progress.correctCount / progress.attempts;
  if (accuracy < 0.7) return W.lowAccuracyMastery;
  if (progress.currentCorrectStreak >= 4) return W.streak4Mastery;
  if (progress.currentCorrectStreak >= 2) return W.streak2Mastery;
  return 1.0;
}

function recencyWeight(progress: QuestionProgress | undefined, now: Date): number {
  if (!progress?.lastAnsweredAt) return 1.0;
  const days = (now.getTime() - new Date(progress.lastAnsweredAt).getTime()) / 86_400_000;
  if (days >= 30) return W.stale30Recency;
  if (days >= 7) return W.stale7Recency;
  return 1.0;
}

function errorWeight(progress?: QuestionProgress): number {
  return progress?.lastAnswerCorrect === false ? W.recentWrongError : 1.0;
}

// W_category は分野間の出題比率を将来調整するためのフック。現状は全分野均等(1.0)。
export function questionWeight(progress: QuestionProgress | undefined, now: Date = new Date()): number {
  const categoryWeight = 1.0;
  return categoryWeight * masteryWeight(progress) * recencyWeight(progress, now) * errorWeight(progress);
}

// 重み付き非復元抽出。rng は 0以上1未満の乱数を返す関数（テスト時に差し替え可能）。
export function weightedSampleWithoutReplacement<T>(
  items: T[],
  weights: number[],
  count: number,
  rng: () => number = Math.random,
): T[] {
  const pool = items.map((item, i) => ({ item, weight: Math.max(weights[i], 1e-9) }));
  const result: T[] = [];
  while (result.length < count && pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = rng() * total;
    let pickIndex = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) {
        pickIndex = i;
        break;
      }
    }
    result.push(pool[pickIndex].item);
    pool.splice(pickIndex, 1);
  }
  return result;
}
