import { useState, type FormEvent } from "react";
import { useAppData } from "../hooks/AppDataContext";
import styles from "./UnlockPage.module.css";

export function UnlockPage() {
  const { submitPassphrase, errorMessage } = useAppData();
  const [passphrase, setPassphrase] = useState("");
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passphrase || submitting) return;
    setSubmitting(true);
    await submitPassphrase(passphrase, remember);
    setSubmitting(false);
    setPassphrase("");
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>証券外務員一種 学習アプリ</h1>
      <p className={styles.desc}>問題データを開くにはパスフレーズを入力してください。</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <input
          className={styles.input}
          type="password"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="パスフレーズ"
          aria-label="パスフレーズ"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          次回から省略する
        </label>
        {errorMessage && (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}
        <button className={styles.submit} type="submit" disabled={!passphrase || submitting}>
          {submitting ? "確認中…" : "開く"}
        </button>
      </form>
    </div>
  );
}
