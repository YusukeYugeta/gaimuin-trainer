import Dexie, { type Table } from "dexie";
import type {
  AnswerRecord,
  AppSettings,
  DailyStudyStat,
  Question,
  QuestionProgress,
  StudySession,
} from "../domain/types";

export interface MetadataEntry {
  key: string;
  value: unknown;
}

// IndexedDB スキーマ。§9 DB名 gaimuin-trainer
export class GaimuinDB extends Dexie {
  questions!: Table<Question, string>;
  questionProgress!: Table<QuestionProgress, string>;
  answerRecords!: Table<AnswerRecord, string>;
  studySessions!: Table<StudySession, string>;
  dailyStats!: Table<DailyStudyStat, string>;
  settings!: Table<AppSettings & { id: string }, string>;
  metadata!: Table<MetadataEntry, string>;

  constructor() {
    super("gaimuin-trainer");
    this.version(1).stores({
      questions: "id, categoryId, active",
      questionProgress: "questionId, masteryStatus, bookmarked",
      answerRecords: "id, questionId, sessionId, answeredAt",
      studySessions: "id, status, startedAt",
      dailyStats: "date",
      settings: "id",
      metadata: "key",
    });
  }
}

export const db = new GaimuinDB();

export const SETTINGS_ID = "app-settings";
