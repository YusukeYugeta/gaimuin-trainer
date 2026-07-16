import { describe, expect, it } from "vitest";
import { questionWeight, weightedSampleWithoutReplacement } from "../src/domain/weighting";
import type { QuestionProgress } from "../src/domain/types";

function progress(partial: Partial<QuestionProgress>): QuestionProgress {
  return {
    questionId: "q",
    attempts: 1,
    correctCount: 1,
    wrongCount: 0,
    currentCorrectStreak: 1,
    maxCorrectStreak: 1,
    bookmarked: false,
    masteryStatus: "learning",
    ...partial,
  };
}

describe("questionWeight", () => {
  it("weighs unseen questions higher than mastered ones", () => {
    const unseen = questionWeight(undefined);
    const mastered = questionWeight(progress({ attempts: 10, correctCount: 10, currentCorrectStreak: 5 }));
    expect(unseen).toBeGreaterThan(mastered);
  });

  it("weighs a recently-wrong question the highest", () => {
    const recentlyWrong = questionWeight(progress({ lastAnswerCorrect: false, currentCorrectStreak: 0 }));
    const normal = questionWeight(progress({ lastAnswerCorrect: true }));
    expect(recentlyWrong).toBeGreaterThan(normal);
  });

  it("boosts stale (30+ day) questions via recency", () => {
    const now = new Date("2024-06-01");
    const stale = questionWeight(
      progress({ lastAnsweredAt: new Date("2024-01-01").toISOString(), currentCorrectStreak: 0, attempts: 3, correctCount: 3 }),
      now,
    );
    const fresh = questionWeight(
      progress({ lastAnsweredAt: new Date("2024-05-31").toISOString(), currentCorrectStreak: 0, attempts: 3, correctCount: 3 }),
      now,
    );
    expect(stale).toBeGreaterThan(fresh);
  });
});

describe("weightedSampleWithoutReplacement", () => {
  it("returns the requested count with no duplicates", () => {
    const items = Array.from({ length: 20 }, (_, i) => `item-${i}`);
    const weights = items.map(() => 1);
    const sample = weightedSampleWithoutReplacement(items, weights, 10, () => 0.5);
    expect(sample.length).toBe(10);
    expect(new Set(sample).size).toBe(10);
  });

  it("clamps to pool size when count exceeds items", () => {
    const items = ["a", "b", "c"];
    const sample = weightedSampleWithoutReplacement(items, [1, 1, 1], 10);
    expect(sample.length).toBe(3);
  });

  it("heavily favors near-zero weighted items less often (statistical)", () => {
    const items = ["heavy", "light"];
    const weights = [1000, 0.001];
    let heavyFirstCount = 0;
    for (let i = 0; i < 200; i++) {
      const [first] = weightedSampleWithoutReplacement(items, weights, 1);
      if (first === "heavy") heavyFirstCount++;
    }
    expect(heavyFirstCount).toBeGreaterThan(180);
  });
});
