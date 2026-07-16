// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db";
import { getAllProgress, getDailyStat, recordAnswer, todayKey } from "../src/db/repo";
import type { AnswerRecord } from "../src/domain/types";

beforeEach(async () => {
  await db.answerRecords.clear();
  await db.questionProgress.clear();
  await db.dailyStats.clear();
});

function makeRecord(overrides: Partial<AnswerRecord>): AnswerRecord {
  return {
    id: `r-${Math.random()}`,
    questionId: "q1",
    sessionId: "s1",
    selectedAnswer: true,
    correctAnswer: true,
    isCorrect: true,
    answeredAt: new Date().toISOString(),
    mode: "random",
    ...overrides,
  };
}

describe("recordAnswer", () => {
  it("persists the answer and recomputes derived progress + daily stats", async () => {
    await recordAnswer(makeRecord({ isCorrect: true, selectedAnswer: true }));
    await recordAnswer(makeRecord({ isCorrect: false, selectedAnswer: false, correctAnswer: true }));

    const progress = await getAllProgress();
    expect(progress).toHaveLength(1);
    expect(progress[0].attempts).toBe(2);
    expect(progress[0].correctCount).toBe(1);
    expect(progress[0].wrongCount).toBe(1);
    expect(progress[0].masteryStatus).toBe("review");

    const stat = await getDailyStat(todayKey());
    expect(stat?.answeredCount).toBe(2);
    expect(stat?.correctCount).toBe(1);
    expect(stat?.uniqueQuestionCount).toBe(1);
  });

  it("never overwrites prior answer records (append-only)", async () => {
    await recordAnswer(makeRecord({ id: "r1" }));
    await recordAnswer(makeRecord({ id: "r2" }));
    const all = await db.answerRecords.toArray();
    expect(all.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
  });
});
