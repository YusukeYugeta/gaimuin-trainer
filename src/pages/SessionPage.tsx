import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppData } from "../hooks/AppDataContext";
import { categoryName } from "../domain/categories";
import { setBookmark } from "../db/repo";
import { answerCurrentQuestion, resumeActiveSession, abandonSession, startSession } from "../services/sessionService";
import { playFeedbackTone, vibrateFeedback } from "../services/feedback";
import { ConfirmDialog } from "../components/ConfirmDialog";
import type { Question, SessionSettings, StudyMode, StudySession } from "../domain/types";
import styles from "./SessionPage.module.css";

interface NavState {
  mode: StudyMode;
  settings: SessionSettings;
  wrongQuestionIds?: string[];
}

interface Answered {
  selected: boolean;
  correct: boolean;
  isCorrect: boolean;
}

export function SessionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { questions, progressByQuestionId, refreshProgress, settings } = useAppData();

  const [session, setSession] = useState<StudySession | null>(null);
  const [pendingSession, setPendingSession] = useState<StudySession | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      const navState = location.state as NavState | null;
      if (navState) {
        const s = await startSession({
          mode: navState.mode,
          settings: navState.settings,
          questions,
          progressByQuestionId,
          wrongQuestionIds: navState.wrongQuestionIds,
        });
        setSession(s);
      } else {
        const active = await resumeActiveSession();
        if (active) setSession(active);
        else setNotFound(true);
      }
      startedAtRef.current = Date.now();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentQuestion: Question | undefined = session
    ? questions.find((q) => q.id === session.questionIds[session.currentIndex])
    : undefined;
  const progress = currentQuestion ? progressByQuestionId.get(currentQuestion.id) : undefined;

  const goNext = () => {
    if (!pendingSession) return;
    if (pendingSession.status === "completed") {
      navigate(`/result/${pendingSession.id}`, { replace: true });
      return;
    }
    setSession(pendingSession);
    setPendingSession(null);
    setAnswered(null);
    startedAtRef.current = Date.now();
    window.scrollTo(0, 0);
    document.querySelector("[data-session-body]")?.scrollTo(0, 0);
  };

  // §5.5 自動遷移
  useEffect(() => {
    if (!answered || !session) return;
    const mode = session.settings.autoAdvance;
    if (mode === "off") return;
    if (mode === "correct-only" && !answered.isCorrect) return;
    const seconds = mode === "correct-only" ? 1 : session.settings.autoAdvanceSeconds ?? 3;
    const timer = setTimeout(goNext, seconds * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, session, pendingSession]);

  const handleSelect = async (selected: boolean) => {
    if (!session || !currentQuestion || answered) return;
    const responseTimeMs = Date.now() - startedAtRef.current;
    const result = await answerCurrentQuestion(session, currentQuestion, selected, responseTimeMs);
    setAnswered({ selected, correct: currentQuestion.answer, isCorrect: result.isCorrect });
    setPendingSession(result.session);
    if (settings.vibration) vibrateFeedback(result.isCorrect);
    if (settings.soundEffect) playFeedbackTone(result.isCorrect);
    await refreshProgress();
  };

  const handleToggleBookmark = async () => {
    if (!currentQuestion) return;
    await setBookmark(currentQuestion.id, !progress?.bookmarked);
    await refreshProgress();
  };

  const handleExit = async () => {
    if (session && session.status === "active") {
      await abandonSession(session);
    }
    navigate("/", { replace: true });
  };

  if (notFound) {
    return (
      <div className={styles.emptyState}>
        <p>再開できるセッションがありません。</p>
        <button type="button" onClick={() => navigate("/", { replace: true })}>
          ホームへ戻る
        </button>
      </div>
    );
  }

  if (!session) {
    return <div className={styles.emptyState}>読み込み中…</div>;
  }

  if (session.questionIds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>出題できる問題がありません。</p>
        <button type="button" onClick={() => navigate("/", { replace: true })}>
          ホームへ戻る
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return <div className={styles.emptyState}>読み込み中…</div>;
  }

  const total = session.questionIds.length;
  const position = session.currentIndex + 1;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.progressText}>
          {position} / {total}
        </span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.iconButton} ${progress?.bookmarked ? styles.bookmarked : ""}`}
            onClick={handleToggleBookmark}
            aria-label="ブックマーク"
            aria-pressed={!!progress?.bookmarked}
          >
            {progress?.bookmarked ? "★" : "☆"}
          </button>
          <button type="button" className={styles.iconButton} onClick={() => setShowExitConfirm(true)} aria-label="セッション終了">
            ✕
          </button>
        </div>
      </div>

      <div className={styles.body} data-session-body>
        <div className={styles.categoryLabel}>{categoryName(currentQuestion.categoryId)}</div>
        <p className={styles.questionText}>{currentQuestion.question}</p>

        {answered && (
          <div className={`${styles.feedback} ${answered.isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}>
            <p className={styles.feedbackTitle}>{answered.isCorrect ? "正解" : "不正解"}</p>
            <p className={styles.answerRow}>あなたの回答: {answered.selected ? "○" : "×"}</p>
            <p className={styles.answerRow}>正解: {answered.correct ? "○" : "×"}</p>
            <p className={styles.explanation}>{currentQuestion.explanation}</p>
            <a className={styles.sourceLink} href={currentQuestion.sourceUrl} target="_blank" rel="noreferrer">
              元ページを開く
            </a>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        {!answered ? (
          <>
            <button type="button" className={`${styles.oxButton} ${styles.oCircle}`} onClick={() => handleSelect(true)}>
              ○
            </button>
            <button type="button" className={`${styles.oxButton} ${styles.xCross}`} onClick={() => handleSelect(false)}>
              ×
            </button>
          </>
        ) : (
          <button type="button" className={styles.nextButton} onClick={goNext}>
            次の問題
          </button>
        )}
      </div>

      {showExitConfirm && (
        <ConfirmDialog
          message="セッションを終了しますか？回答済みの履歴は保存されます。"
          confirmLabel="終了する"
          onConfirm={handleExit}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </div>
  );
}
