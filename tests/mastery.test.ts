import { describe, expect, it } from "vitest";
import { computeMasteryStatus, recomputeProgress, isWeakQuestion } from "../src/domain/mastery";
import type { AnswerRecord } from "../src/domain/types";

function record(isCorrect: boolean, answeredAt: string): AnswerRecord {
  return {
    id: `r-${answeredAt}`,
    questionId: "q1",
    sessionId: "s1",
    selectedAnswer: isCorrect,
    correctAnswer: true,
    isCorrect,
    answeredAt,
    mode: "random",
  };
}

describe("computeMasteryStatus", () => {
  it("is unseen with zero attempts", () => {
    expect(computeMasteryStatus({ attempts: 0, correctCount: 0, currentCorrectStreak: 0 })).toBe("unseen");
  });

  it("is review when last answer was wrong", () => {
    expect(
      computeMasteryStatus({ attempts: 3, correctCount: 2, currentCorrectStreak: 0, lastAnswerCorrect: false }),
    ).toBe("review");
  });

  it("is review when accuracy under 70%", () => {
    expect(
      computeMasteryStatus({ attempts: 10, correctCount: 5, currentCorrectStreak: 1, lastAnswerCorrect: true }),
    ).toBe("review");
  });

  it("is mastered with 3+ streak and 80%+ accuracy", () => {
    expect(
      computeMasteryStatus({ attempts: 5, correctCount: 5, currentCorrectStreak: 3, lastAnswerCorrect: true }),
    ).toBe("mastered");
  });

  it("is stale when mastered but unanswered for 30+ days", () => {
    const old = new Date("2024-01-01").toISOString();
    const now = new Date("2024-03-01");
    expect(
      computeMasteryStatus(
        { attempts: 5, correctCount: 5, currentCorrectStreak: 3, lastAnswerCorrect: true, lastAnsweredAt: old },
        now,
      ),
    ).toBe("stale");
  });

  it("is learning otherwise", () => {
    expect(
      computeMasteryStatus({ attempts: 1, correctCount: 1, currentCorrectStreak: 1, lastAnswerCorrect: true }),
    ).toBe("learning");
  });
});

describe("recomputeProgress", () => {
  it("derives streaks and status from an ordered answer history", () => {
    const records = [
      record(true, "2024-01-01T00:00:00Z"),
      record(false, "2024-01-02T00:00:00Z"),
      record(true, "2024-01-03T00:00:00Z"),
      record(true, "2024-01-04T00:00:00Z"),
      record(true, "2024-01-05T00:00:00Z"),
    ];
    const progress = recomputeProgress("q1", records, false, new Date("2024-01-06T00:00:00Z"));
    expect(progress.attempts).toBe(5);
    expect(progress.correctCount).toBe(4);
    expect(progress.wrongCount).toBe(1);
    expect(progress.currentCorrectStreak).toBe(3);
    expect(progress.maxCorrectStreak).toBe(3);
    expect(progress.masteryStatus).toBe("mastered");
  });

  it("is order-independent (sorts by answeredAt)", () => {
    const records = [
      record(true, "2024-01-03T00:00:00Z"),
      record(true, "2024-01-01T00:00:00Z"),
      record(false, "2024-01-02T00:00:00Z"),
    ];
    const progress = recomputeProgress("q1", records, false);
    expect(progress.currentCorrectStreak).toBe(1);
    expect(progress.lastAnswerCorrect).toBe(true);
  });
});

describe("isWeakQuestion", () => {
  it("is false for undefined progress", () => {
    expect(isWeakQuestion(undefined)).toBe(false);
  });

  it("is true when bookmarked even with good accuracy", () => {
    expect(
      isWeakQuestion({
        questionId: "q1",
        attempts: 10,
        correctCount: 10,
        wrongCount: 0,
        currentCorrectStreak: 10,
        maxCorrectStreak: 10,
        bookmarked: true,
        masteryStatus: "mastered",
      }),
    ).toBe(true);
  });
});
