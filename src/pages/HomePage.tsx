import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../hooks/AppDataContext";
import { CATEGORIES, categoryName } from "../domain/categories";
import { getAllDailyStatsSorted, getConsecutiveStudyDays, getCurrentCorrectStreak, getDailyStat, todayKey } from "../db/repo";
import { resumeActiveSession } from "../services/sessionService";
import type { DailyStudyStat, SessionSettings, StudySession } from "../domain/types";
import styles from "./HomePage.module.css";

const QUESTION_COUNTS: Array<{ label: string; value: number | "unlimited" }> = [
  { label: "10問", value: 10 },
  { label: "30問", value: 30 },
  { label: "50問", value: 50 },
  { label: "無制限", value: "unlimited" },
];

export function HomePage() {
  const { settings } = useAppData();
  const navigate = useNavigate();
  const [today, setToday] = useState<DailyStudyStat | null>(null);
  const [streak, setStreak] = useState(0);
  const [studyDays, setStudyDays] = useState(0);
  const [recentStats, setRecentStats] = useState<DailyStudyStat[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | undefined>();
  const [count, setCount] = useState<number | "unlimited">(settings.defaultQuestionCount);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [t, s, days, all, active] = await Promise.all([
        getDailyStat(todayKey()),
        getCurrentCorrectStreak(),
        getConsecutiveStudyDays(),
        getAllDailyStatsSorted(),
        resumeActiveSession(),
      ]);
      setToday(t ?? null);
      setStreak(s);
      setStudyDays(days);
      setRecentStats(all.slice(0, 7));
      setActiveSession(active);
    })();
  }, []);

  const answered = today?.answeredCount ?? 0;
  const correct = today?.correctCount ?? 0;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  const goStart = (mode: "random" | "weak" | "unanswered" | "category", categoryIds?: string[]) => {
    const sessionSettings: SessionSettings = {
      questionCount: count,
      retryWrongEnabled: settings.retryWrongEnabled,
      autoAdvance: settings.autoAdvance,
      autoAdvanceSeconds: settings.autoAdvanceSeconds,
      categoryIds,
    };
    navigate("/session", { state: { mode, settings: sessionSettings } });
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{answered}</div>
          <div className={styles.statLabel}>今日の回答</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{correct}</div>
          <div className={styles.statLabel}>今日の正解</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{accuracy}%</div>
          <div className={styles.statLabel}>今日の正答率</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{streak}</div>
          <div className={styles.statLabel}>連続正解</div>
        </div>
      </div>

      {studyDays > 0 && (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
          連続学習日数: {studyDays}日
        </p>
      )}

      {activeSession && (
        <div className={styles.resumeBanner}>
          <span>中断中のセッションがあります</span>
          <button type="button" onClick={() => navigate("/session")}>
            再開する
          </button>
        </div>
      )}

      <button type="button" className={styles.primaryButton} onClick={() => goStart("random")}>
        標準演習を始める（{count === "unlimited" ? "無制限" : `${count}問`}）
      </button>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>出題数</div>
        <div className={styles.countRow}>
          {QUESTION_COUNTS.map((c) => (
            <button
              key={String(c.value)}
              type="button"
              className={`${styles.countBtn} ${count === c.value ? styles.countBtnActive : ""}`}
              onClick={() => setCount(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>モードを選ぶ</div>
        <div className={styles.linkRow}>
          <button type="button" className={styles.linkButton} onClick={() => goStart("weak")}>
            苦手問題を演習する
          </button>
          <button type="button" className={styles.linkButton} onClick={() => goStart("unanswered")}>
            未回答問題を演習する
          </button>
          <button type="button" className={styles.linkButton} onClick={() => setShowCategoryPicker((v) => !v)}>
            分野別に演習する {showCategoryPicker ? "▲" : "▼"}
          </button>
          {showCategoryPicker && (
            <>
              <div className={styles.categoryGrid}>
                {CATEGORIES.map((c) => (
                  <label key={c.id} className={styles.categoryChip}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                    />
                    {categoryName(c.id)}
                  </label>
                ))}
              </div>
              <button
                type="button"
                className={styles.countBtnActive}
                style={{ minHeight: 44, borderRadius: 10, border: "none" }}
                disabled={selectedCategories.length === 0}
                onClick={() => goStart("category", selectedCategories)}
              >
                選択した分野で開始
              </button>
            </>
          )}
        </div>
      </div>

      {recentStats.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>最近の学習履歴</div>
          <div className={styles.historyList}>
            {recentStats.map((s) => (
              <div key={s.date} className={styles.historyRow}>
                <span>{s.date}</span>
                <span>
                  {s.answeredCount}問中{s.correctCount}正解
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
