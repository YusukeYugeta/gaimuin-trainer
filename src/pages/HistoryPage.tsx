import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../hooks/AppDataContext";
import { CATEGORIES, categoryName } from "../domain/categories";
import { getAllAnswerRecords, getAllDailyStatsSorted, getConsecutiveStudyDays, getDailyStat, todayKey } from "../db/repo";
import type { AnswerRecord, DailyStudyStat, SessionSettings } from "../domain/types";
import styles from "./HistoryPage.module.css";

const STATUS_LABELS: Record<string, string> = {
  unseen: "未回答",
  learning: "学習中",
  review: "要復習",
  mastered: "習得",
  stale: "要再確認",
};

export function HistoryPage() {
  const { questions, progressByQuestionId, settings } = useAppData();
  const navigate = useNavigate();
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStudyStat[]>([]);
  const [studyDays, setStudyDays] = useState(0);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [r, d, days, t] = await Promise.all([
        getAllAnswerRecords(),
        getAllDailyStatsSorted(),
        getConsecutiveStudyDays(),
        getDailyStat(todayKey()),
      ]);
      setRecords(r);
      setDailyStats(d.slice(0, 30));
      setStudyDays(days);
      setTodayCount(t?.answeredCount ?? 0);
    })();
  }, []);

  const totalAnswered = records.length;
  const totalCorrect = records.filter((r) => r.isCorrect).length;
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { unseen: 0, learning: 0, review: 0, mastered: 0, stale: 0 };
    const answeredIds = new Set(progressByQuestionId.keys());
    counts.unseen = Math.max(questions.length - answeredIds.size, 0);
    for (const p of progressByQuestionId.values()) {
      counts[p.masteryStatus] = (counts[p.masteryStatus] ?? 0) + 1;
    }
    return counts;
  }, [questions, progressByQuestionId]);

  const categoryStats = useMemo(() => {
    const categoryOf = new Map(questions.map((q) => [q.id, q.categoryId]));
    const agg = new Map<string, { answered: number; correct: number }>();
    for (const r of records) {
      const catId = categoryOf.get(r.questionId);
      if (!catId) continue;
      const entry = agg.get(catId) ?? { answered: 0, correct: 0 };
      entry.answered++;
      if (r.isCorrect) entry.correct++;
      agg.set(catId, entry);
    }
    return CATEGORIES.map((c) => {
      const entry = agg.get(c.id) ?? { answered: 0, correct: 0 };
      return {
        id: c.id,
        name: categoryName(c.id),
        answered: entry.answered,
        accuracy: entry.answered > 0 ? Math.round((entry.correct / entry.answered) * 100) : null,
      };
    });
  }, [questions, records]);

  const startCategoryPractice = (categoryId: string) => {
    const sessionSettings: SessionSettings = {
      questionCount: settings.defaultQuestionCount,
      retryWrongEnabled: settings.retryWrongEnabled,
      autoAdvance: settings.autoAdvance,
      autoAdvanceSeconds: settings.autoAdvanceSeconds,
      categoryIds: [categoryId],
    };
    navigate("/session", { state: { mode: "category", settings: sessionSettings } });
  };

  return (
    <div className={styles.page}>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{totalAnswered}</div>
          <div className={styles.summaryLabel}>累計回答数</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{overallAccuracy}%</div>
          <div className={styles.summaryLabel}>累計正答率</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{todayCount}</div>
          <div className={styles.summaryLabel}>今日の回答数</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{studyDays}日</div>
          <div className={styles.summaryLabel}>連続学習日数</div>
        </div>
      </div>

      <div>
        <p className={styles.sectionTitle}>習熟状況</p>
        <div className={styles.statusRow}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className={styles.statusChip}>
              <div className={styles.summaryValue}>{statusCounts[key] ?? 0}</div>
              <div className={styles.summaryLabel}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className={styles.sectionTitle}>分野別集計</p>
        {categoryStats.map((c) => (
          <button key={c.id} type="button" className={styles.categoryRow} onClick={() => startCategoryPractice(c.id)}>
            <span>{c.name}</span>
            <span>{c.answered > 0 ? `${c.answered}問 / ${c.accuracy}%` : "未回答"}</span>
          </button>
        ))}
      </div>

      <div>
        <p className={styles.sectionTitle}>日別集計（過去30日）</p>
        {dailyStats.length === 0 && <p style={{ color: "var(--color-text-muted)" }}>まだ記録がありません。</p>}
        {dailyStats.map((s) => (
          <div key={s.date} className={styles.dailyRow}>
            <span>{s.date}</span>
            <span>
              {s.answeredCount}問中{s.correctCount}正解（
              {s.answeredCount > 0 ? Math.round((s.correctCount / s.answeredCount) * 100) : 0}%）
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
