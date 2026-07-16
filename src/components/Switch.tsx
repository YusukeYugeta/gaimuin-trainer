import styles from "../pages/SettingsPage.module.css";

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className={`${styles.switchKnob} ${checked ? styles.switchOnKnob : ""}`} />
    </button>
  );
}
