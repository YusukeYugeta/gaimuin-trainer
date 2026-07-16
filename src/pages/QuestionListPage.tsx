import { useMemo, useState } from "react";
import { useAppData } from "../hooks/AppDataContext";
import { CATEGORIES, categoryName } from "../domain/categories";
import { getAnswerRecordsForQuestion } from "../db/repo";
import type { AnswerRecord, MasteryStatus } from "../domain/types";
import styles from "./QuestionListPage.module.css";

type StatusFilter = "all" | MasteryStatus;
type AccuracyFilter = "all" | "low" | "high";

const STATUS_LABELS: Record<MasteryStatus, string> = {
  unseen: "未回答",
  learning: "学習中",
  review: "要復習",
  mastered: "習得",
  stale: "要再確認",
};

export function QuestionListPage() {
  const { questions, progressByQuestionId } = useAppData();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [accuracyFilter, setAccuracyFilter] = useState<AccuracyFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyByQuestion, setHistoryByQuestion] = useState<Record<string, AnswerRecord[]>>({});

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      const progress = progressByQuestionId.get(q.id);
      const status: MasteryStatus = progress?.masteryStatus ?? "unseen";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (categoryFilter !== "all" && q.categoryId !== categoryFilter) return false;
      if (bookmarkOnly && !progress?.bookmarked) return false;
      if (tagQuery && !q.tags.some((t) => t.includes(tagQuery))) return false;
      if (accuracyFilter !== "all") {
        if (!progress || progress.attempts === 0) return false;
        const accuracy = progress.correctCount / progress.attempts;
        if (accuracyFilter === "low" && accuracy >= 0.7) return false;
        if (accuracyFilter === "high" && accuracy < 0.7) return false;
      }
      return true;
    });
  }, [questions, progressByQuestionId, statusFilter, categoryFilter, bookmarkOnly, tagQuery, accuracyFilter]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!historyByQuestion[id]) {
      const records = await getAnswerRecordsForQuestion(id);
      setHistoryByQuestion((prev) => ({ ...prev, [id]: records }));
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.filters}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="all">状態: すべて</option>
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">分野: すべて</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryName(c.id)}
            </option>
          ))}
        </select>
        <select value={accuracyFilter} onChange={(e) => setAccuracyFilter(e.target.value as AccuracyFilter)}>
          <option value="all">正答率: すべて</option>
          <option value="low">70%未満</option>
          <option value="high">70%以上</option>
        </select>
        <input
          type="text"
          placeholder="タグ検索"
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
        />
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={bookmarkOnly} onChange={(e) => setBookmarkOnly(e.target.checked)} />
          ブックマークのみ
        </label>
      </div>

      <p className={styles.resultCount}>{filtered.length}件</p>

      <div className={styles.list}>
        {filtered.map((q) => {
          const progress = progressByQuestionId.get(q.id);
          const status = progress?.masteryStatus ?? "unseen";
          const expanded = expandedId === q.id;
          return (
            <div key={q.id} className={styles.row}>
              <button type="button" className={styles.rowHeader} onClick={() => toggleExpand(q.id)}>
                <span className={styles.rowQuestion}>{q.question}</span>
                <span className={styles.badge}>
                  {progress?.bookmarked ? "★ " : ""}
                  {STATUS_LABELS[status]}
                </span>
              </button>
              {expanded && (
                <div className={styles.detail}>
                  <p>{categoryName(q.categoryId)}</p>
                  <p className={styles.detailAnswer}>正解: {q.answer ? "○" : "×"}</p>
                  <p>{q.explanation}</p>
                  <p>
                    回答回数: {progress?.attempts ?? 0} / 正解数: {progress?.correctCount ?? 0}
                  </p>
                  {(historyByQuestion[q.id] ?? []).length > 0 && (
                    <p>
                      直近回答:{" "}
                      {(historyByQuestion[q.id] ?? [])
                        .slice(-5)
                        .map((r) => `${r.answeredAt.slice(0, 10)}(${r.isCorrect ? "○" : "×"})`)
                        .join(" / ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
