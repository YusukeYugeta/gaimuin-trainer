import type { Question, QuestionProgress, StudyMode } from "./types";
import { isWeakQuestion } from "./mastery";
import { questionWeight, weightedSampleWithoutReplacement } from "./weighting";

export interface BuildQueueParams {
  questions: Question[];
  progressByQuestionId: Map<string, QuestionProgress>;
  mode: StudyMode;
  count: number; // Infinity で無制限
  categoryIds?: string[];
  recentlyShownIds?: Set<string>; // 直近20問以内に出題済み
  wrongQuestionIds?: string[]; // retryモード用: 誤答再演習の対象
  now?: Date;
  rng?: () => number;
}

function filterByMode(questions: Question[], progressByQuestionId: Map<string, QuestionProgress>, params: BuildQueueParams): Question[] {
  const active = questions.filter((q) => q.active);
  switch (params.mode) {
    case "unanswered":
      return active.filter((q) => !progressByQuestionId.get(q.id));
    case "weak":
      return active.filter((q) => isWeakQuestion(progressByQuestionId.get(q.id)));
    case "category": {
      const ids = new Set(params.categoryIds ?? []);
      return active.filter((q) => ids.has(q.categoryId));
    }
    case "retry": {
      const wrongIds = new Set(params.wrongQuestionIds ?? []);
      return active.filter((q) => wrongIds.has(q.id));
    }
    case "random":
    default:
      return active;
  }
}

// §7 重複防止: セッション内既正解・直近20問以内出題・出題キュー内の問題は候補から除外。
// 不足時は順に緩和する。
export function buildSessionQueue(params: BuildQueueParams): string[] {
  const { progressByQuestionId, now = new Date(), rng } = params;
  const candidates = filterByMode(params.questions, progressByQuestionId, params);
  const count = params.count === Infinity ? candidates.length : Math.min(params.count, candidates.length);
  if (count === 0) return [];

  const recentlyShown = params.recentlyShownIds ?? new Set();
  const chosen: string[] = [];
  const chosenSet = new Set<string>();

  // 誤答再演習・無制限モードでは重複除外を行わない
  const skipDedup = params.mode === "retry" || params.count === Infinity;

  // 緩和段階: 0=直近20問除外あり, 1=直近20問除外なし, 2=無条件(出題キュー内重複のみ回避)
  for (let stage = 0; chosen.length < count && stage <= 2; stage++) {
    const pool = candidates.filter((q) => {
      if (chosenSet.has(q.id)) return false;
      if (skipDedup) return true;
      if (stage === 0 && recentlyShown.has(q.id)) return false;
      return true;
    });
    if (pool.length === 0) continue;
    const weights = pool.map((q) => questionWeight(progressByQuestionId.get(q.id), now));
    const picked = weightedSampleWithoutReplacement(pool, weights, count - chosen.length, rng);
    for (const q of picked) {
      chosen.push(q.id);
      chosenSet.add(q.id);
    }
  }
  return chosen;
}

const RETRY_MIN_GAP = 5;
const RETRY_ELIGIBLE_MIN_COUNT = 30; // 10問セッションは対象外。30以上・無制限はあり

// §7 誤答再提示: 同一セッション内で5問以上間隔を空けて一度だけ再提示。
export function scheduleRetryInsertion(
  queue: string[],
  currentIndex: number,
  questionId: string,
  sessionQuestionCount: number, // Infinity for 無制限
  alreadyRetried: Set<string>,
): string[] {
  if (alreadyRetried.has(questionId)) return queue;
  const eligible = sessionQuestionCount === Infinity || sessionQuestionCount >= RETRY_ELIGIBLE_MIN_COUNT;
  if (!eligible) return queue;

  const insertAt = Math.min(currentIndex + 1 + RETRY_MIN_GAP, queue.length);
  const next = [...queue];
  next.splice(insertAt, 0, questionId);
  alreadyRetried.add(questionId);
  return next;
}
