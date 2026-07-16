# 証券外務員一種 学習PWA 仕様書（簡約版）

## 1. 概要

| 項目 | 内容 |
|---|---|
| 仮称 | Gaimuin Trainer |
| 対象ユーザー | 開発者本人のみ（非公開・非商用） |
| 主端末 | iPhone（副: PC・iPad） |
| 形式 | PWA / ○×問題 |
| 配信 | GitHub Pages（GitHub Actions デプロイ） |

**目的**: 外務員一種の○×問題をスマホで短時間反復する自分専用アプリ。ランダム出題・即時フィードバック・弱点優先再出題・オフライン利用・履歴の端末内保存を実現する。

## 2. 前提

- 個人利用のみ。一般公開・データ再配布・商用運用はしない。
- GitHub Pages は URL を知れば誰でも見られるため:
  - 問題データは**暗号化して配置**し、ブラウザー内でのみ復号する
  - パスフレーズはリポジトリに保存しない
  - noindex を指定する（ただし noindex/URL秘匿はアクセス制御ではない。保護は暗号化で行う）
- 必須対応: iPhone Safari / ホーム画面PWA / PC Chrome・Safari。Android は初版で厳密検証しない。

## 3. システム構成

```
問題サイト → Pythonスクレイパー(PC上で一度だけ) → questions.raw.json
  → 暗号化 → questions.enc → push → GitHub Actions → GitHub Pages
  → iPhone PWA（端末上で復号 / IndexedDB / Service Worker）
```

**技術スタック**: React + TypeScript + Vite / vite-plugin-pwa / IndexedDB (Dexie.js) / CSS Modules / Python (requests + BeautifulSoup) / AES-GCM暗号化 / Vitest

**採用しない**: バックエンド、ユーザーアカウント、Firebase/Supabase/Next.js、外部分析・広告・AI API。

## 4. リポジトリ構成

```
gaimuin-trainer/
├── .github/workflows/deploy.yml
├── public/
│   ├── data/questions.enc
│   ├── icons/ (192, 512)
│   ├── robots.txt
│   └── manifest.webmanifest
├── scraper/ (scrape.py, normalize.py, encrypt.py, output/)
├── src/ (components, pages, db, domain, services, hooks, styles, App.tsx, main.tsx)
├── tests/
└── vite.config.ts ほか
```

`questions.raw.json`・`scraper/output/`・`.env*` は Git 管理外。

## 5. 機能要件

### 5.1 初回起動（パスフレーズ入力）

1. `questions.enc` 取得 → パスフレーズから鍵導出 → ブラウザー内復号 → JSON検証 → ホームへ。
- パスフレーズは保存・外部送信・平文永続化しない
- 復号失敗時は原因を詳細表示しない
- 「次回から省略」を任意で選択可（鍵そのものではなく端末内で安全に扱える形式で保持。利便性機能として扱う）

### 5.2 ホーム画面

- 今日の回答数・正解数・正答率・連続正解を表示
- 起動後1タップで標準演習（30問ランダム）を開始
- 出題数選択（10/30/50/無制限）、苦手問題・未回答問題・分野別演習への導線
- 最近の学習履歴（日別）を表示。片手操作前提。

### 5.3 演習モード

| モード | 対象 |
|---|---|
| ランダム | 全分野から重み付き抽選（§7） |
| 苦手問題 | 直近不正解 / 累計正答率70%未満 / 不正解2回以上 / 要復習 / ブックマーク のいずれか |
| 未回答 | 回答履歴なしの問題のみ |
| 分野別 | 選択分野のみ（複数選択可） |
| 誤答再演習 | セッション終了画面から誤答のみ再出題 |

### 5.4 出題分野

取得元の分類を正規化し14分野（証券市場の基礎知識、金商法、勧誘・販売法律、協会定款、取引所定款、株式業務、債券業務、投信・投資法人、付随業務、デリバティブ、会社法、経済・金融・財政、財務諸表、証券税制）。内部はカテゴリID（例: `derivatives`）で管理し、表示名変更で履歴が壊れないようにする。

### 5.5 出題画面

**回答前**: 問題番号/総数、分野名、問題文（18px以上）、○×ボタン（画面下部固定・十分なタップ領域）、ブックマーク、セッション終了。回答前に正解・解説は見せない。重複回答を防止し、回答後の変更は不可。

**回答後**: 正誤を**文字で**明示（色だけに頼らない）、自分の回答と正解を並記、解説を即表示、元ページリンク（新規タブ）、「次の問題」ボタン。不正解は自動で復習対象へ追加。

**遷移**: 初版は手動「次の問題」。自動遷移（なし/正解時のみ1秒/常に指定秒）を設定可。初期値は自動遷移なし。

## 6. セッション仕様

- 出題数: 10 / 30(標準) / 50 / 100 / 無制限
- 中断時は確認ダイアログ（回答済み履歴は保存）。中断セッションは可能なら再開可（モード・条件・出題予定ID・現在位置・回答結果・日時を保存）
- 有限セッション内では原則同一問題を重複出題しない（例外: 誤答再確認、無制限モード、対象問題不足時）

## 7. 出題アルゴリズム

問題ごとに `W = W_category × W_mastery × W_recency × W_error` で重み付き抽選。

| 条件 | 重み |
|---|---|
| 未回答 | mastery 1.5 |
| 直近不正解 | error 3.0 |
| 累計正答率70%未満 | mastery 2.0 |
| 連続正解2回以上 / 4回以上 | mastery 0.8 / 0.4 |
| 30日以上未出題 / 7日以上未出題 | recency 2.0 / 1.3 |

**重複防止**: セッション内既正解・直近20問以内出題・出題キュー内の問題は候補から除外。不足時は順に緩和。

**誤答再提示**: 同一セッション内で5問以上間隔を空けて一度だけ再提示（10問セッションはなし、30問以上・無制限はあり）。再提示で正解しても元の誤答履歴は残す。

## 8. 習熟度管理

| 状態 | 条件 |
|---|---|
| unseen | 回答0回 |
| learning | 回答1回以上、習熟未達 |
| review | 直近不正解 or 正答率70%未満 |
| mastered | 直近3連続正解かつ累計正答率80%以上 |
| stale | mastered だが30日以上未回答 |

回答ごとに再計算。

## 9. データモデル

```typescript
interface Question {
  id: string;              // {categoryId}-{sourcePageId}。不安定なら問題文ハッシュを補助
  source: string;
  sourceUrl: string;
  categoryId: string;
  subcategoryId?: string;
  question: string;
  answer: boolean;
  explanation: string;
  tags: string[];
  active: boolean;
  contentHash: string;     // 差分検出用
  scrapedAt: string;
  updatedAt?: string;
}

interface AnswerRecord {   // 追記型。上書きしない
  id: string;
  questionId: string;
  sessionId: string;
  selectedAnswer: boolean;
  correctAnswer: boolean;
  isCorrect: boolean;
  answeredAt: string;
  responseTimeMs?: number;
  mode: StudyMode;
}

interface QuestionProgress {  // AnswerRecordから再生成可能な派生データ
  questionId: string;
  attempts: number;
  correctCount: number;
  wrongCount: number;
  currentCorrectStreak: number;
  maxCorrectStreak: number;
  lastAnswerCorrect?: boolean;
  lastAnsweredAt?: string;
  bookmarked: boolean;
  masteryStatus: "unseen" | "learning" | "review" | "mastered" | "stale";
}

interface DailyStudyStat {
  date: string;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  studyTimeMs: number;
  uniqueQuestionCount: number;
}

interface StudySession {
  id: string;
  mode: StudyMode;
  questionIds: string[];
  currentIndex: number;
  startedAt: string;
  completedAt?: string;
  status: "active" | "completed" | "abandoned";
  settings: SessionSettings;
}
```

**IndexedDB**: DB名 `gaimuin-trainer`。テーブル: questions / questionProgress / answerRecords / studySessions / dailyStats / settings / metadata。スキーマに明示的バージョン番号。問題データにも `schemaVersion` / `datasetVersion` / `questionCount` / `generatedAt` のメタデータ。データ更新時も回答履歴は維持。

## 10. スクレイピングとデータ更新

**方針**: 取得はPC上でのみ・一度だけ。リクエスト間隔2〜5秒ランダム、指数バックオフ、User-Agent明示、キャッシュ済みページは再取得しない。

**抽出**: 分野・小分野・問題文・正解・解説・元URL・ページID・取得日時。

**バリデーション**: 問題文/解説が非空、正解が○×判定可能、分野設定済み、URL有効、ID重複なし。正解の抽出失敗は推測せずエラー一覧へ。

**更新手順**: `scrape.py → normalize.py → validate.py → encrypt.py` → `questions.enc` のみ commit/push。`contentHash` 比較で新規/変更/削除を検出しログ出力。

## 11. 暗号化

- AES-GCM、PBKDF2で鍵導出（iterations 250,000）
- salt / IV はランダム生成し暗号化ファイルに含める。パスフレーズは含めない
- 認証タグを検証、復号失敗時はデータを読み込まない

```json
{ "version": 1, "algorithm": "AES-GCM", "kdf": "PBKDF2",
  "iterations": 250000, "salt": "base64", "iv": "base64", "ciphertext": "base64" }
```

## 12. PWA

**Manifest**: name「証券外務員一種」、`display: standalone`、`orientation: portrait`、アイコン192/512px。

**ホーム画面追加**: iOSは共有メニューから。初回起動時または設定画面に手順を表示。

**オフライン（Service Worker）**:

| 対象 | 戦略 |
|---|---|
| アプリ本体（HTML/JS/CSS/アイコン/manifest） | Cache First |
| questions.enc | Stale While Revalidate |
| 元問題ページ・外部 | キャッシュしない |

**更新通知**: 新バージョン検出時に「更新する/後で」を表示。演習中は強制リロードしない。

## 13. デプロイ

- Vite `base: "/gaimuin-trainer/"`（プロジェクトサイトの場合）
- main への push で: 依存インストール → 型チェック → テスト → ビルド → Pages デプロイ
- **デプロイ停止条件**: 型エラー / テスト失敗 / 復号テスト失敗 / 問題件数0 / マニフェスト不正 / ビルド失敗
- `robots.txt` で全拒否 + `<meta name="robots" content="noindex, nofollow, noarchive">`

## 14. 画面（履歴・一覧・設定）

**学習履歴**: 累計回答数・正答率、今日の回答数、連続学習日数、未回答/要復習/習得数。分野別集計（正答率・回答数、タップで詳細と分野別演習開始）。日別集計は過去30日一覧（グラフは後回し可）。

**問題一覧**: フィルター（状態/ブックマーク/分野/タグ/正答率/最終回答日）。一覧では正解を直接表示しない。選択で問題文・正解・解説・履歴を閲覧。

**設定**: 標準出題数(30) / 誤答再出題(有効) / 自動遷移(無効) / ダークモード(OS追従) / 文字サイズ(標準) / 振動(有効) / 効果音(無効) / 習熟判定基準 / バックアップ・復元 / 履歴リセット / データ再読み込み / アプリ情報。

## 15. バックアップ

- **エクスポート**: 回答履歴・統計・セッション・日別・設定・ブックマークをJSON出力（問題本文は含めない）
- **インポート**: JSON形式・スキーマバージョン・必須フィールド・ID/日時形式を検証。初版は全置換のみで可
- 自動サーバー保存はなし。設定画面にバックアップ推奨表示。

## 16. UI・UX

- モバイル優先: 基準375px、対応320〜1440px、縦向き基本
- 主要ボタン高さ48px以上、○×ボタン各幅40%以上、Safe Area考慮、押下フィードバック、問題遷移時スクロール先頭へ
- アクセシビリティ: 色だけで伝えない、正誤は文字表示、十分なコントラスト、キーボード対応、ARIAラベル、prefers-reduced-motion 尊重
- デザイン: 読みやすさ優先、問題文と○×を最も目立たせる、正解=緑/不正解=赤は補助的、ダークモード対応

## 17. 非機能要件

- **性能**: 初回表示3秒以内、問題遷移・回答反映100ms以内、1,000問・回答履歴10万件を扱える設計
- **可用性**: Pages障害時もキャッシュ済み範囲で利用可、データ更新失敗時は直前データ維持、IndexedDB書き込み失敗は通知
- **セキュリティ/プライバシー**: 外部送信なし、平文データをGitHubに置かない、パスフレーズ非埋め込み、外部JS/フォント/トラッキング/Cookieなし、CSPを可能な範囲で設定、依存最小限

## 18. エラー処理

| エラー | 対応 |
|---|---|
| データ取得失敗 | キャッシュ済みデータ使用 |
| パスフレーズ不正/復号失敗 | 再入力を促す（データは読み込まない） |
| JSON不正 | 更新中止 |
| IndexedDB利用不可 | 利用不能を表示 |
| 容量不足 | バックアップと履歴整理を案内 |
| 元ページ消失 | 問題表示は維持、リンク無効表示 |
| PWA更新失敗 | 現行バージョン継続 |
| 問題数不足 | 出題可能数を表示して開始 |

## 19. 受け入れ条件

- **基本**: iPhone Safariで開ける / ホーム画面追加・standalone起動 / 30問演習開始 / ○×回答 / 即時正誤・解説表示 / セッション結果表示
- **履歴**: IndexedDBに保存・再起動後も残る / 今日の統計が正しい / 誤答が苦手問題に反映 / JSON書き出し・復元可
- **オフライン**: 一度オンライン起動後、機内モードで起動・回答・保存でき、復帰後も履歴維持
- **データ保護**: リポジトリ・Pages上に平文データなし / 正しいパスフレーズでのみ復号可

## 20. 開発フェーズ

1. **静的プロトタイプ**: ダミー10問、ホーム/出題/結果画面、○×回答、スマホUI検証
2. **履歴管理**: IndexedDB、回答履歴、問題別統計、苦手/未回答、日別集計
3. **問題データ**: スクレイパー、正規化、バリデーション、ID固定、暗号化
4. **PWA**: Manifest、Service Worker、オフライン、更新通知、ホーム画面追加検証
5. **配信**: GitHub Actions、Pages、base path、noindex、本番検証
6. **改善**: 重み付き出題、誤答再出題、バックアップ、問題一覧、分野別統計、UI調整

**初版では不要**: ログイン、サーバー同期、プッシュ通知、AI解説、選択式・計算問題、統計グラフ、管理画面、自動スクレイピング。

**将来拡張候補**（優先度順）: 端末間手動同期、iCloudバックアップ、五肢選択、計算問題、メモ、全文検索、タグ管理、間隔反復、学習計画、模試、出題比率設定、法改正差分、自作問題、CSVインポート、AI補足。

## 21. 完成定義

iPhoneのホーム画面から起動し、パスフレーズで問題データを解除した後、オフラインを含め複数分野から30問をランダムに解ける。回答ごとに正誤と解説が表示され、学習履歴・苦手問題・未回答問題・日別正答率が端末内に保存される。問題データはGitHub Pages上に平文で公開されない。
