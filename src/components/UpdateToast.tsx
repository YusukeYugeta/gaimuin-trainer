import { useRegisterSW } from "virtual:pwa-register/react";
import styles from "./UpdateToast.module.css";

// §12: 新バージョン検出時に「更新する/後で」を表示。演習中は強制リロードしない。
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className={styles.toast} role="status">
      <span>新しいバージョンがあります</span>
      <div className={styles.actions}>
        <button type="button" onClick={() => setNeedRefresh(false)}>
          後で
        </button>
        <button type="button" className={styles.primary} onClick={() => updateServiceWorker(true)}>
          更新する
        </button>
      </div>
    </div>
  );
}
