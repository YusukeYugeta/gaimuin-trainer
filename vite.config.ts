import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages プロジェクトサイト想定のベースパス
const BASE = process.env.VITE_BASE_PATH || "/gaimuin-trainer/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["robots.txt", "icons/*.png"],
      manifest: {
        name: "証券外務員一種",
        short_name: "外務員一種",
        description: "証券外務員一種の○×問題を反復学習する個人用アプリ",
        display: "standalone",
        orientation: "portrait",
        start_url: BASE,
        scope: BASE,
        background_color: "#ffffff",
        theme_color: "#1a5fb4",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith("questions.enc"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "questions-data" },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
