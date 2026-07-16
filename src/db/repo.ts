import { db, SETTINGS_ID } from "./index";
import { recomputeProgress } from "../domain/mastery";
import { DEFAULT_SETTINGS } from "../domain/types";
import type { AnswerRecord, AppSettings, Question, StudySession } from "../domain/types";

// --- questions -------------------------------------------------------

export interface QuestionsDataset {
  schemaVersion: number;
  datasetVersion: string;
  questionCount: number;
  generatedAt: string;
  questions: Question[];
}

// 問題データの読込。既存の回答履歴・進捗はquestionId単位のため影響を受けない。
export async function loadQuestionsDataset(dataset: QuestionsDataset): Promise<void> {
  await db.questions.bulkPut(dataset.questions);
  await db.metadata.bulkPut([
    { key: "schemaVersion", value: dataset.schemaVersion },
    { key: "datasetVersion", value: dataset.datasetVersion },
    { key: "questionCount", value: dataset.questionCount },
    { key: "generatedAt", value: dataset.generatedAt },
  ]);
}

export function getAllQuestions(): Promise<Question[]> {
  return db.questions.toArray();
}

export async function getDatasetMetadata(): Promise<Record<string, unknown>> {
  const rows = await db.metadata.toArray();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// --- answers / progress ----------------------------------------------

async function refreshProgress(questionId: string, now = new Date()) {
  const [records, existing] = await Promise.all([
    db.answerRecords.where("questionId").equals(questionId).toArray(),
    db.questionProgress.get(questionId),
  ]);
  const progress = recomputeProgress(questionId, records, existing?.bookmarked ?? false, now);
  await db.questionProgress.put(progress);
  return progress;
}

async function refreshDailyStat(dateKey: string) {
  const start = `${dateKey}T00:00:00`;
  const end = `${dateKey}T23:59:59.999`;
  const records = await db.answerRecords.where("answeredAt").between(start, end, true, true).toArray();
  const correctCount = records.filter((r) => r.isCorrect).length;
  const studyTimeMs = records.reduce((sum, r) => sum + (r.responseTimeMs ?? 0), 0);
  const uniqueQuestionCount = new Set(records.map((r) => r.questionId)).size;
  await db.dailyStats.put({
    date: dateKey,
    answeredCount: records.length,
    correctCount,
    wrongCount: records.length - correctCount,
    studyTimeMs,
    uniqueQuestionCount,
  });
}

// 回答を記録(追記のみ、上書きしない)し、派生データを再計算する。
export async function recordAnswer(record: AnswerRecord): Promise<void> {
  await db.answerRecords.add(record);
  const dateKey = record.answeredAt.slice(0, 10);
  await Promise.all([refreshProgress(record.questionId), refreshDailyStat(dateKey)]);
}

export function getAllProgress() {
  return db.questionProgress.toArray();
}

export function getAllAnswerRecords() {
  return db.answerRecords.toArray();
}

export function getAnswerRecordsForQuestion(questionId: string) {
  return db.answerRecords.where("questionId").equals(questionId).toArray();
}

export async function setBookmark(questionId: string, bookmarked: boolean): Promise<void> {
  const existing = await db.questionProgress.get(questionId);
  if (existing) {
    await db.questionProgress.put({ ...existing, bookmarked });
    return;
  }
  await db.questionProgress.put(
    recomputeProgress(questionId, [], bookmarked),
  );
}

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getDailyStat(dateKey: string) {
  return db.dailyStats.get(dateKey);
}

export async function getCurrentCorrectStreak(limit = 200): Promise<number> {
  const recent = await db.answerRecords.orderBy("answeredAt").reverse().limit(limit).toArray();
  let streak = 0;
  for (const r of recent) {
    if (r.isCorrect) streak++;
    else break;
  }
  return streak;
}

export async function getAllDailyStatsSorted() {
  const all = await db.dailyStats.toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getConsecutiveStudyDays(now = new Date()): Promise<number> {
  const stats = await getAllDailyStatsSorted();
  const byDate = new Map(stats.map((s) => [s.date, s]));
  let streak = 0;
  const cursor = new Date(now);
  for (;;) {
    const key = todayKey(cursor);
    const stat = byDate.get(key);
    if (!stat || stat.answeredCount === 0) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getRecentDailyStats(days: number, now = new Date()) {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(todayKey(d));
  }
  return db.dailyStats.bulkGet(keys);
}

// --- sessions ----------------------------------------------------------

export function saveSession(session: StudySession) {
  return db.studySessions.put(session);
}

export function getActiveSession() {
  return db.studySessions.where("status").equals("active").first();
}

export function getSession(id: string) {
  return db.studySessions.get(id);
}

// --- settings ------------------------------------------------------------

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.get(SETTINGS_ID);
  return row ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ ...settings, id: SETTINGS_ID });
}

// --- reset -----------------------------------------------------------------

export async function resetHistory(): Promise<void> {
  await db.transaction(
    "rw",
    [db.answerRecords, db.questionProgress, db.dailyStats, db.studySessions],
    async () => {
      await db.answerRecords.clear();
      await db.questionProgress.clear();
      await db.dailyStats.clear();
      await db.studySessions.clear();
    },
  );
}
