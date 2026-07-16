import { describe, expect, it } from "vitest";
import { buildSessionQueue, scheduleRetryInsertion } from "../src/domain/queue";
import type { Question, QuestionProgress } from "../src/domain/types";

function makeQuestion(id: string, categoryId = "market-basics"): Question {
  return {
    id,
    source: "example.com",
    sourceUrl: `https://example.com/${id}`,
    categoryId,
    question: `question ${id}`,
    answer: true,
    explanation: "exp",
    tags: [],
    active: true,
    contentHash: "hash",
    scrapedAt: "2024-01-01T00:00:00Z",
  };
}

const questions = Array.from({ length: 30 }, (_, i) => makeQuestion(`q${i}`));

describe("buildSessionQueue", () => {
  it("builds a queue of the requested size with no duplicates", () => {
    const queue = buildSessionQueue({
      questions,
      progressByQuestionId: new Map(),
      mode: "random",
      count: 15,
    });
    expect(queue.length).toBe(15);
    expect(new Set(queue).size).toBe(15);
  });

  it("filters to unanswered questions only", () => {
    const progressByQuestionId = new Map<string, QuestionProgress>();
    progressByQuestionId.set("q0", {
      questionId: "q0",
      attempts: 1,
      correctCount: 1,
      wrongCount: 0,
      currentCorrectStreak: 1,
      maxCorrectStreak: 1,
      bookmarked: false,
      masteryStatus: "learning",
    });
    const queue = buildSessionQueue({
      questions,
      progressByQuestionId,
      mode: "unanswered",
      count: 100,
    });
    expect(queue).not.toContain("q0");
    expect(queue.length).toBe(questions.length - 1);
  });

  it("relaxes the recently-shown exclusion when the pool is too small", () => {
    const recentlyShownIds = new Set(questions.slice(0, 25).map((q) => q.id));
    const queue = buildSessionQueue({
      questions,
      progressByQuestionId: new Map(),
      mode: "random",
      count: 10,
      recentlyShownIds,
    });
    // 除外後は5問しか残らないため、緩和して10問確保できる
    expect(queue.length).toBe(10);
  });

  it("returns an empty queue when no candidates match the mode filter", () => {
    const queue = buildSessionQueue({
      questions,
      progressByQuestionId: new Map(),
      mode: "category",
      count: 10,
      categoryIds: ["derivatives"],
    });
    expect(queue).toEqual([]);
  });
});

describe("scheduleRetryInsertion", () => {
  it("inserts the question at least 5 positions ahead", () => {
    const queue = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const retried = new Set<string>();
    const next = scheduleRetryInsertion(queue, 1, "a", 30, retried);
    expect(next.indexOf("a", 2)).toBeGreaterThanOrEqual(1 + 1 + 5);
    expect(retried.has("a")).toBe(true);
  });

  it("does not insert twice for the same question", () => {
    const queue = ["a", "b", "c", "d", "e", "f"];
    const retried = new Set<string>(["a"]);
    const next = scheduleRetryInsertion(queue, 0, "a", 30, retried);
    expect(next).toEqual(queue);
  });

  it("does not insert for 10-question sessions", () => {
    const queue = ["a", "b", "c", "d", "e", "f"];
    const next = scheduleRetryInsertion(queue, 0, "a", 10, new Set());
    expect(next).toEqual(queue);
  });

  it("inserts for unlimited sessions", () => {
    const queue = ["a", "b", "c", "d", "e", "f"];
    const next = scheduleRetryInsertion(queue, 0, "a", Infinity, new Set());
    expect(next.length).toBe(queue.length + 1);
  });
});
