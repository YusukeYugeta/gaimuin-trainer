import { useEffect, useRef, useState } from "react";
import { useAppData } from "../hooks/AppDataContext";
import { Switch } from "../components/Switch";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { exportBackup, importBackup, BackupValidationError } from "../db/backup";
import { resetHistory, getDatasetMetadata } from "../db/repo";
import type { AppSettings } from "../domain/types";
import styles from "./SettingsPage.module.css";

const APP_VERSION = "0.1.0";

export function SettingsPage() {
  const { settings, updateSettings, reloadQuestions } = useAppData();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [datasetInfo, setDatasetInfo] = useState<Record<string, unknown>>({});
  const [showMasteryInfo, setShowMasteryInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDatasetMetadata().then(setDatasetInfo);
  }, []);

  const patch = (partial: Partial<AppSettings>) => updateSettings({ ...settings, ...partial });

  const handleExport = async () => {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gaimuin-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      await importBackup(JSON.parse(text));
      await reloadQuestions();
      setMessage("復元しました。");
    } catch (err) {
      setMessage(err instanceof BackupValidationError ? `復元に失敗しました: ${err.message}` : "復元に失敗しました。");
    }
  };

  const handleResetHistory = async () => {
    await resetHistory();
    await reloadQuestions();
    setShowResetConfirm(false);
    setMessage("学習履歴をリセットしました。");
  };

  return (
    <div className={styles.page}>
      {message && <div className={styles.infoBlock}>{message}</div>}

      <div className={styles.section}>
        <p className={styles.sectionTitle}>演習設定</p>
        <div className={styles.row}>
          <span>標準出題数</span>
          <select
            value={settings.defaultQuestionCount}
            onChange={(e) => patch({ defaultQuestionCount: Number(e.target.value) })}
          >
            {[10, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}問
              </option>
            ))}
          </select>
        </div>
        <div className={styles.row}>
          <span>誤答再出題</span>
          <Switch checked={settings.retryWrongEnabled} onChange={(v) => patch({ retryWrongEnabled: v })} label="誤答再出題" />
        </div>
        <div className={styles.row}>
          <span>自動遷移</span>
          <select
            value={settings.autoAdvance}
            onChange={(e) => patch({ autoAdvance: e.target.value as AppSettings["autoAdvance"] })}
          >
            <option value="off">なし</option>
            <option value="correct-only">正解時のみ1秒</option>
            <option value="always">常に指定秒</option>
          </select>
        </div>
        {settings.autoAdvance === "always" && (
          <div className={styles.row}>
            <span>自動遷移の秒数</span>
            <select
              value={settings.autoAdvanceSeconds}
              onChange={(e) => patch({ autoAdvanceSeconds: Number(e.target.value) })}
            >
              {[1, 2, 3, 5].map((n) => (
                <option key={n} value={n}>
                  {n}秒
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>表示</p>
        <div className={styles.row}>
          <span>ダークモード</span>
          <select value={settings.darkMode} onChange={(e) => patch({ darkMode: e.target.value as AppSettings["darkMode"] })}>
            <option value="system">OS追従</option>
            <option value="light">ライト</option>
            <option value="dark">ダーク</option>
          </select>
        </div>
        <div className={styles.row}>
          <span>文字サイズ</span>
          <select value={settings.fontSize} onChange={(e) => patch({ fontSize: e.target.value as AppSettings["fontSize"] })}>
            <option value="standard">標準</option>
            <option value="large">大</option>
          </select>
        </div>
        <div className={styles.row}>
          <span>振動</span>
          <Switch checked={settings.vibration} onChange={(v) => patch({ vibration: v })} label="振動" />
        </div>
        <div className={styles.row}>
          <span>効果音</span>
          <Switch checked={settings.soundEffect} onChange={(v) => patch({ soundEffect: v })} label="効果音" />
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>習熟判定基準</p>
        <button type="button" className={styles.actionButton} onClick={() => setShowMasteryInfo((v) => !v)}>
          {showMasteryInfo ? "閉じる" : "基準を表示"}
        </button>
        {showMasteryInfo && (
          <div className={styles.infoBlock}>
            未回答=unseen / 直近不正解か正答率70%未満=review / 直近3連続正解かつ累計正答率80%以上=mastered
            （30日以上未回答でstale） / それ以外=learning
          </div>
        )}
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>バックアップ</p>
        <button type="button" className={styles.actionButton} onClick={handleExport}>
          回答履歴をエクスポート
        </button>
        <button type="button" className={styles.actionButton} onClick={() => fileInputRef.current?.click()}>
          バックアップから復元
        </button>
        <input
          ref={fileInputRef}
          className={styles.hiddenFileInput}
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>データ管理</p>
        <button type="button" className={styles.actionButton} onClick={() => location.reload()}>
          データを再読み込み
        </button>
        <button type="button" className={`${styles.actionButton} ${styles.dangerButton}`} onClick={() => setShowResetConfirm(true)}>
          学習履歴をリセット
        </button>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>ホーム画面への追加(iOS)</p>
        <div className={styles.infoBlock}>Safariの共有メニューから「ホーム画面に追加」を選択してください。</div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>アプリ情報</p>
        <div className={styles.infoBlock}>
          バージョン: {APP_VERSION}
          <br />
          問題データ件数: {String(datasetInfo.questionCount ?? "-")}
          <br />
          データ生成日時: {String(datasetInfo.generatedAt ?? "-")}
        </div>
      </div>

      {showResetConfirm && (
        <ConfirmDialog
          message="学習履歴をすべてリセットします。この操作は元に戻せません。"
          confirmLabel="リセットする"
          onConfirm={handleResetHistory}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
}
