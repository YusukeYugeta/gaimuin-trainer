import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSession } from "../db/repo";
import { getSessionAnswerRecords } from "../services/sessionService";
import type { AnswerRecord, SessionSettings, StudySession } from "../domain/types";
import styles from "./ResultPage.module.css";

export function ResultPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<StudySession | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const [s, r] = await Promise.all([getSession(sessionId), getSessionAnswerRecords(sessionId)]);
      setSession(s ?? null);
      setRecords(r);
    })();
  }, [sessionId]);

  if (!session) return <div className={styles.page}>読み込み中…</div>;

  const answeredCount = records.length;
  const correctCount = records.filter((r) => r.isCorrect).length;
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const wrongQuestionIds = [...new Set(records.filter((r) => !r.isCorrect).map((r) => r.questionId))];

  const retrySettings: SessionSettings = {
    questionCount: wrongQuestionIds.length,
    retryWrongEnabled: false,
    autoAdvance: session.settings.autoAdvance,
    autoAdvanceSeconds: session.settings.autoAdvanceSeconds,
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>お疲れさまでした</h1>
      <div className={styles.scoreCircle}>
        <div className={styles.scoreValue}>{accuracy}%</div>
        <div className={styles.scoreLabel}>正答率</div>
      </div>
      <div className={styles.statsRow}>
        <span>回答数: {answeredCount}</span>
        <span>正解: {correctCount}</span>
        <span>不正解: {answeredCount - correctCount}</span>
      </div>
      <div className={styles.actions}>
        {wrongQuestionIds.length > 0 && (
          <button
            type="button"
            className={styles.primary}
            onClick={() =>
              navigate("/session", { state: { mode: "retry", settings: retrySettings, wrongQuestionIds } })
            }
          >
            誤答のみ再演習する（{wrongQuestionIds.length}問）
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={() => navigate("/", { replace: true })}>
          ホームへ戻る
        </button>
      </div>
    </div>
  );
}
