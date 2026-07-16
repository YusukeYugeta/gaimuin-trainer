import { db } from "../db";
import { getActiveSession, recordAnswer, saveSession } from "../db/repo";
import { buildSessionQueue, scheduleRetryInsertion } from "../domain/queue";
import type { AnswerRecord, Question, QuestionProgress, SessionSettings, StudyMode, StudySession } from "../domain/types";

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getRecentlyShownIds(limit = 20): Promise<Set<string>> {
  const recent = await db.answerRecords.orderBy("answeredAt").reverse().limit(limit).toArray();
  return new Set(recent.map((r) => r.questionId));
}

export interface StartSessionParams {
  mode: StudyMode;
  settings: SessionSettings;
  questions: Question[];
  progressByQuestionId: Map<string, QuestionProgress>;
  wrongQuestionIds?: string[];
}

export async function startSession(params: StartSessionParams): Promise<StudySession> {
  const recentlyShownIds = await getRecentlyShownIds();
  const count = params.settings.questionCount === "unlimited" ? Infinity : params.settings.questionCount;
  const questionIds = buildSessionQueue({
    questions: params.questions,
    progressByQuestionId: params.progressByQuestionId,
    mode: params.mode,
    count,
    categoryIds: params.settings.categoryIds,
    recentlyShownIds,
    wrongQuestionIds: params.wrongQuestionIds,
  });

  const session: StudySession = {
    id: newId("session"),
    mode: params.mode,
    questionIds,
    currentIndex: 0,
    startedAt: new Date().toISOString(),
    status: "active",
    settings: params.settings,
  };
  await saveSession(session);
  return session;
}

export interface AnswerResult {
  session: StudySession;
  isCorrect: boolean;
}

const retriedByCache = new Map<string, Set<string>>();
function retriedSetFor(sessionId: string): Set<string> {
  let s = retriedByCache.get(sessionId);
  if (!s) {
    s = new Set();
    retriedByCache.set(sessionId, s);
  }
  return s;
}

export async function answerCurrentQuestion(
  session: StudySession,
  question: Question,
  selectedAnswer: boolean,
  responseTimeMs?: number,
): Promise<AnswerResult> {
  const isCorrect = selectedAnswer === question.answer;
  const record: AnswerRecord = {
    id: newId("answer"),
    questionId: question.id,
    sessionId: session.id,
    selectedAnswer,
    correctAnswer: question.answer,
    isCorrect,
    answeredAt: new Date().toISOString(),
    responseTimeMs,
    mode: session.mode,
  };
  await recordAnswer(record);

  let questionIds = session.questionIds;
  const sessionCount = session.settings.questionCount === "unlimited" ? Infinity : session.settings.questionCount;
  if (!isCorrect && session.settings.retryWrongEnabled && session.mode !== "retry") {
    questionIds = scheduleRetryInsertion(
      questionIds,
      session.currentIndex,
      question.id,
      sessionCount,
      retriedSetFor(session.id),
    );
  }

  const nextIndex = session.currentIndex + 1;
  const updated: StudySession = {
    ...session,
    questionIds,
    currentIndex: nextIndex,
    status: nextIndex >= questionIds.length ? "completed" : "active",
    completedAt: nextIndex >= questionIds.length ? new Date().toISOString() : undefined,
  };
  await saveSession(updated);
  return { session: updated, isCorrect };
}

export async function abandonSession(session: StudySession): Promise<StudySession> {
  const updated: StudySession = { ...session, status: "abandoned", completedAt: new Date().toISOString() };
  await saveSession(updated);
  return updated;
}

export function resumeActiveSession(): Promise<StudySession | undefined> {
  return getActiveSession();
}

export async function getSessionAnswerRecords(sessionId: string): Promise<AnswerRecord[]> {
  return db.answerRecords.where("sessionId").equals(sessionId).toArray();
}
