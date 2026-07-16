import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
      <BottomNav />
    </>
  );
}
