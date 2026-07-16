import { NavLink } from "react-router-dom";
import styles from "./BottomNav.module.css";

const ITEMS = [
  { to: "/", label: "ホーム", icon: "🏠" },
  { to: "/history", label: "履歴", icon: "📊" },
  { to: "/questions", label: "問題一覧", icon: "📋" },
  { to: "/settings", label: "設定", icon: "⚙️" },
];

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="メインナビゲーション">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}
        >
          <span className={styles.icon} aria-hidden="true">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
