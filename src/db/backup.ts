import { db, SETTINGS_ID } from "./index";
import { recomputeProgress } from "../domain/mastery";
import type { AnswerRecord, AppSettings, DailyStudyStat, StudySession } from "../domain/types";

const BACKUP_SCHEMA_VERSION = 1;

// §15: 問題本文は含めない。回答履歴・統計・セッション・日別・設定・ブックマークのみ。
export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  answerRecords: AnswerRecord[];
  dailyStats: DailyStudyStat[];
  studySessions: StudySession[];
  settings: AppSettings;
  bookmarkedQuestionIds: string[];
}

export async function exportBackup(now = new Date()): Promise<BackupFile> {
  const [answerRecords, dailyStats, studySessions, settingsRow, progress] = await Promise.all([
    db.answerRecords.toArray(),
    db.dailyStats.toArray(),
    db.studySessions.toArray(),
    db.settings.get(SETTINGS_ID),
    db.questionProgress.toArray(),
  ]);
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    answerRecords,
    dailyStats,
    studySessions,
    settings: settingsRow ?? ({} as AppSettings),
    bookmarkedQuestionIds: progress.filter((p) => p.bookmarked).map((p) => p.questionId),
  };
}

export class BackupValidationError extends Error {}

function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && !Number.isNaN(Date.parse(s));
}

export function validateBackup(data: unknown): BackupFile {
  if (typeof data !== "object" || data === null) throw new BackupValidationError("形式が不正です");
  const d = data as Partial<BackupFile>;
  if (d.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new BackupValidationError("スキーマバージョンが不正です");
  if (!Array.isArray(d.answerRecords) || !Array.isArray(d.dailyStats) || !Array.isArray(d.studySessions)) {
    throw new BackupValidationError("必須フィールドが不足しています");
  }
  if (!isIsoDate(d.exportedAt)) throw new BackupValidationError("日時形式が不正です");
  for (const r of d.answerRecords) {
    if (!r.id || !r.questionId || !isIsoDate(r.answeredAt)) {
      throw new BackupValidationError("回答履歴の形式が不正です");
    }
  }
  return d as BackupFile;
}

// 初版は全置換のみ。
export async function importBackup(data: unknown): Promise<void> {
  const backup = validateBackup(data);
  await db.transaction(
    "rw",
    [db.answerRecords, db.dailyStats, db.studySessions, db.settings, db.questionProgress],
    async () => {
      await db.answerRecords.clear();
      await db.dailyStats.clear();
      await db.studySessions.clear();
      await db.questionProgress.clear();

      await db.answerRecords.bulkAdd(backup.answerRecords);
      await db.dailyStats.bulkPut(backup.dailyStats);
      await db.studySessions.bulkPut(backup.studySessions);
      if (backup.settings) await db.settings.put({ ...backup.settings, id: SETTINGS_ID });

      const bookmarked = new Set(backup.bookmarkedQuestionIds ?? []);
      const byQuestion = new Map<string, AnswerRecord[]>();
      for (const r of backup.answerRecords) {
        const list = byQuestion.get(r.questionId) ?? [];
        list.push(r);
        byQuestion.set(r.questionId, list);
      }
      const questionIds = new Set([...byQuestion.keys(), ...bookmarked]);
      const progressRows = [...questionIds].map((qid) =>
        recomputeProgress(qid, byQuestion.get(qid) ?? [], bookmarked.has(qid)),
      );
      await db.questionProgress.bulkPut(progressRows);
    },
  );
}
