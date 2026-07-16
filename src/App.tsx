import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppDataProvider, useAppData } from "./hooks/AppDataContext";
import { UnlockPage } from "./pages/UnlockPage";
import { HomePage } from "./pages/HomePage";
import { SessionPage } from "./pages/SessionPage";
import { ResultPage } from "./pages/ResultPage";
import { HistoryPage } from "./pages/HistoryPage";
import { QuestionListPage } from "./pages/QuestionListPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Layout } from "./components/Layout";
import { UpdateToast } from "./components/UpdateToast";

function useApplyDisplaySettings() {
  const { settings } = useAppData();
  useEffect(() => {
    const root = document.documentElement;
    if (settings.darkMode === "system") delete root.dataset.theme;
    else root.dataset.theme = settings.darkMode;
    root.style.setProperty("--font-scale", settings.fontSize === "large" ? "1.2" : "1");
  }, [settings.darkMode, settings.fontSize]);
}

function AppShellReady() {
  useApplyDisplaySettings();
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <HomePage />
            </Layout>
          }
        />
        <Route
          path="/history"
          element={
            <Layout>
              <HistoryPage />
            </Layout>
          }
        />
        <Route
          path="/questions"
          element={
            <Layout>
              <QuestionListPage />
            </Layout>
          }
        />
        <Route
          path="/settings"
          element={
            <Layout>
              <SettingsPage />
            </Layout>
          }
        />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/result/:sessionId" element={<ResultPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

function AppInner() {
  const { state, errorMessage } = useAppData();

  if (state === "checking") {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>読み込み中…</div>
    );
  }

  if (state === "fetch-error") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
        <p>{errorMessage}</p>
        <button type="button" onClick={() => location.reload()}>
          再試行
        </button>
      </div>
    );
  }

  if (state === "need-passphrase") return <UnlockPage />;

  return <AppShellReady />;
}

export function App() {
  return (
    <AppDataProvider>
      <div className="app-shell">
        <AppInner />
      </div>
      <UpdateToast />
    </AppDataProvider>
  );
}
