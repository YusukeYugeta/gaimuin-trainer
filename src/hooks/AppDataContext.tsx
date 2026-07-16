import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppSettings, Question, QuestionProgress } from "../domain/types";
import { DEFAULT_SETTINGS } from "../domain/types";
import { db } from "../db";
import { getAllProgress, getAllQuestions, getSettings, saveSettings as persistSettings } from "../db/repo";
import { DatasetFetchError, fetchEncryptedFile, tryAutoUnlock, unlockWithPassphrase } from "../services/datasetLoader";
import { DecryptionError, type EncryptedFile } from "../services/crypto";

type UnlockState = "checking" | "need-passphrase" | "ready" | "fetch-error";

interface AppDataValue {
  state: UnlockState;
  errorMessage: string | null;
  questions: Question[];
  progressByQuestionId: Map<string, QuestionProgress>;
  settings: AppSettings;
  submitPassphrase: (passphrase: string, remember: boolean) => Promise<void>;
  refreshProgress: () => Promise<void>;
  updateSettings: (next: AppSettings) => Promise<void>;
  reloadQuestions: () => Promise<void>;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UnlockState>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [encFile, setEncFile] = useState<EncryptedFile | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progressList, setProgressList] = useState<QuestionProgress[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const progressByQuestionId = useMemo(
    () => new Map(progressList.map((p) => [p.questionId, p])),
    [progressList],
  );

  const loadFromIndexedDb = useCallback(async () => {
    const [qs, progress, appSettings] = await Promise.all([getAllQuestions(), getAllProgress(), getSettings()]);
    setQuestions(qs);
    setProgressList(progress);
    setSettings(appSettings);
  }, []);

  const refreshProgress = useCallback(async () => {
    setProgressList(await getAllProgress());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let file: EncryptedFile;
      try {
        file = await fetchEncryptedFile();
      } catch (err) {
        if (err instanceof DatasetFetchError) {
          const cachedCount = await db.questions.count();
          if (cachedCount > 0) {
            await loadFromIndexedDb();
            if (!cancelled) setState("ready");
            return;
          }
        }
        if (!cancelled) {
          setErrorMessage("問題データを取得できませんでした。ネットワーク接続を確認してください。");
          setState("fetch-error");
        }
        return;
      }
      if (cancelled) return;
      setEncFile(file);

      const autoOk = await tryAutoUnlock(file).catch(() => false);
      if (cancelled) return;
      if (autoOk) {
        await loadFromIndexedDb();
        if (!cancelled) setState("ready");
        return;
      }
      setState("need-passphrase");
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFromIndexedDb]);

  const submitPassphrase = useCallback(
    async (passphrase: string, remember: boolean) => {
      if (!encFile) return;
      setErrorMessage(null);
      try {
        await unlockWithPassphrase(encFile, passphrase, remember);
        await loadFromIndexedDb();
        setState("ready");
      } catch (err) {
        if (err instanceof DecryptionError) {
          setErrorMessage("パスフレーズが正しくないか、データを読み込めませんでした。");
        } else {
          setErrorMessage("読み込みに失敗しました。");
        }
      }
    },
    [encFile, loadFromIndexedDb],
  );

  const updateSettings = useCallback(async (next: AppSettings) => {
    await persistSettings(next);
    setSettings(next);
  }, []);

  const value: AppDataValue = {
    state,
    errorMessage,
    questions,
    progressByQuestionId,
    settings,
    submitPassphrase,
    refreshProgress,
    updateSettings,
    reloadQuestions: loadFromIndexedDb,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
