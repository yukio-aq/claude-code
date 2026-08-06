# Claude Code — テックリード向け個人設定

Claude Code をテックリードとして使い倒すための設定・エージェント・ワークフロー集。

37個の専門エージェント・15のスラッシュコマンド・自動化フックで、
設計からコミットまでの開発フローを自動化する。
エージェントの品質を定点観測する eval システムと、継続学習による知見蓄積サイクルを内蔵。
日報・半期レビューなど個人の業務ログ運用（Obsidian連携）もカバーする。

---

## セットアップ

### 前提条件

- [Claude Code](https://claude.ai/code) がインストール済み
- Node.js 18以上
- Git

### 手順

**1. リポジトリをクローン**

```bash
git clone <このリポジトリのURL> ~/Desktop/claude-code
cd ~/Desktop/claude-code
```

**2. セットアップスクリプトを実行**

```bash
bash setup.sh
```

`~/.claude/` に以下のシンボリックリンクが作成される:

```
~/.claude/
├── agents  → ~/Desktop/claude-code/agents/
├── commands → ~/Desktop/claude-code/commands/
├── hooks   → ~/Desktop/claude-code/hooks/
├── rules   → ~/Desktop/claude-code/rules/
└── skills  → ~/Desktop/claude-code/skills/
```

**なぜシンボリックリンクを貼るのか:**

Claude Code は `agents` / `commands` / `hooks` / `rules` / `skills` を必ず
`~/.claude/` 配下から読み込む。一方でこの設定一式は Git で管理・バージョン管理
したい（差分レビュー・複数マシン間の同期・他人へのポータブルな配布）ため、
実体は `~/.claude/` の外（このリポジトリ）に置いている。

実体を `~/.claude/` の中に直接置いてしまうと、`~/.claude/` には認証情報・
セッションキャッシュ・ローカル専用の `settings.json` などGit管理したくない
ファイルも同居しているため、リポジトリ化がしにくくなる。シンボリックリンクに
することで:

- Claude Code は普段通り `~/.claude/` を参照するだけで動く
- 実体はこのリポジトリ配下にあるので、通常のエディタ/IDEで編集すればそのまま
  即反映される（コピー同期が不要）
- 複数マシンでは `git clone` + `setup.sh` を実行するだけで同じ設定を再現できる

なお `settings.json` はシンボリックリンクにせず `~/.claude/settings.json` に
直接生成する。Hook設定はマシン固有のパス・環境に依存する要素を含みうるため、
リポジトリ側では管理せずローカルの実体として扱う。

**3. Tavily APIキーを設定（Web検索を使う場合）**

```bash
# ~/.zshrc または ~/.zprofile に追加
export TAVILY_API_KEY="tvly-xxxxxxxxxxxxxxxxxxxx"
```

APIキーは https://app.tavily.com で取得できる。

**4. MCPサーバーを設定**

`~/.claude.json` の `mcpServers` に追記:

```json
{
  "mcpServers": {
    "tavily": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "tavily-mcp@latest"],
      "env": {
        "TAVILY_API_KEY": "tvly-xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

**5. 動作確認**

```bash
claude
```

Claude Code を起動して `/help` でコマンド一覧が表示されれば完了。

---

## ディレクトリ構成

```
~/Desktop/claude-code/
├── CLAUDE.md                    # グローバル行動指針（全プロジェクト共通）
├── README.md                    # このファイル
├── setup.sh                     # 初期セットアップスクリプト
│
├── agents/                      # 専門エージェント定義（37個）
│   ├── orchestration/
│   │   └── chief-of-staff.md        # 大きなタスクの司令塔
│   ├── design/
│   │   ├── requirements-analyst.md  # 要件定義書作成
│   │   ├── planner.md               # 実装計画作成
│   │   ├── architect.md             # 技術選定・ADR作成
│   │   ├── refactor-planner.md      # 技術的負債解消計画
│   │   ├── ui-designer.md           # UIデザイン設計
│   │   ├── ai-agent-designer.md     # AIエージェント設計（Mastra/LangChain/LlamaIndex）
│   │   ├── domain-analyst.md        # 顧客業界のドメイン知識収集（上流工程）
│   │   └── proposal-estimator.md    # RFP分析・工数/費用見積もり・提案書作成（受注前）
│   ├── implement/
│   │   ├── frontend-implementer.md
│   │   ├── backend-implementer.md
│   │   ├── ios-implementer.md
│   │   ├── android-implementer.md
│   │   ├── 3d-implementer.md
│   │   ├── ai-agent-implementer.md  # AIエージェント実装（Mastra/LangChain/LlamaIndex）
│   │   ├── fix-implementer.md       # バグ修正・既存コード修正専門
│   │   └── refactor-implementer.md  # リファクタ計画書に従って実装
│   ├── test/
│   │   ├── qa-engineer.md           # テスト戦略設計
│   │   ├── test-implementer.md      # テスト実装・カバレッジ補完
│   │   └── e2e-implementer.md       # Playwright E2Eテスト
│   ├── review/
│   │   ├── frontend-reviewer.md
│   │   ├── backend-reviewer.md
│   │   ├── ios-reviewer.md
│   │   ├── android-reviewer.md
│   │   ├── 3d-reviewer.md
│   │   ├── ai-agent-reviewer.md
│   │   ├── architecture-reviewer.md # アーキテクチャ品質レビュー
│   │   ├── security-auditor.md      # セキュリティ横断レビュー
│   │   ├── database-reviewer.md     # DBスキーマ・クエリレビュー
│   │   ├── qa-reviewer.md           # テスト戦略・実装レビュー
│   │   ├── requirements-reviewer.md # 要件定義書レビュー
│   │   ├── plan-reviewer.md         # 実装計画書レビュー
│   │   ├── adr-reviewer.md          # ADRレビュー
│   │   └── code-investigator.md     # バグ原因究明・影響範囲調査
│   ├── docs/
│   │   └── doc-writer.md            # ドキュメント生成
│   ├── release/
│   │   └── pr-author.md             # コミット前チェック・PR作成
│   └── ops/
│       └── observability-engineer.md # OpenTelemetry・SLO設計
│
├── commands/                    # スラッシュコマンド（15個）
│   ├── estimate.md              # /estimate
│   ├── domain.md                # /domain
│   ├── requirements.md          # /requirements
│   ├── plan.md                  # /plan
│   ├── adr.md                   # /adr
│   ├── test.md                  # /test
│   ├── review.md                # /review
│   ├── doc.md                   # /doc
│   ├── ship.md                  # /ship
│   ├── save.md                  # /save
│   ├── learn.md                 # /learn
│   ├── curate.md                # /curate
│   ├── eval.md                  # /eval
│   ├── nippo.md                 # /nippo（Obsidian日報）
│   └── hanki-review.md          # /hanki-review（Obsidian半期レビュー）
│
├── hooks/                       # 自動化スクリプト（4個・settings.jsonで有効化するのは3個）
│   ├── session-load.js          # 前回セッションを初回プロンプト時に1回だけ注入（UserPromptSubmit hook）
│   ├── format-check.js          # ファイル変更後にフォーマット確認（PostToolUse hook）
│   ├── bash-guard.js            # 危険コマンド / force push / コミット前チェック（PreToolUse hook）
│   └── skill-router.js          # プロンプトから関連スキルを自動検出・提示（UserPromptSubmit hook、未登録・実験中）
│
├── rules/                       # 常時適用ルール（7個）
│   ├── principles.md                 # 実装・レビューの行動原則（悪例/良例）
│   ├── accountability.md             # 判断根拠の記録ルール
│   ├── testing.md                    # テスト方針・カバレッジ基準
│   ├── security.md                   # セキュリティ禁止事項
│   ├── git.md                        # ブランチ戦略・コミット規約
│   ├── dependencies.md               # ライブラリ管理・設計遵守
│   └── capability-surface-selection.md  # rules/skills/hooks/MCP の使い分け基準
│
├── skills/                      # ドメイン知識・ベストプラクティス
│   ├── ai-agent-patterns/       # Mastra/LangChain/LlamaIndex設計パターン
│   ├── agent-eval/              # エージェント品質評価フレームワーク（YAML タスク形式）
│   ├── orchestration/           # マルチエージェント協調パターン（parallel / adversarial 等）
│   ├── architecture/            # ADRテンプレート・システム設計・技術選定
│   ├── design-principles/       # 設計思想カタログ（Tidy First/DRY/YAGNI/KISS/SOLID等）
│   ├── coding-standards/        # 領域別コーディング規約（3D/android/backend/frontend/ios）
│   ├── frameworks/              # フレームワーク別実装パターン（Next.js/Vue/Django/FastAPI/Laravel/Mastra 等20種）
│   ├── api-design/              # API設計・レスポンス形式・エラーコード・バリデーション
│   ├── database/                # DB設計・マイグレーション・クエリ最適化
│   ├── error-handling/          # エラー設計パターン（カスタムエラー階層・Result型）
│   ├── observability/           # OpenTelemetry・LGTMスタック・SLO設計・GenAIトレーシング
│   ├── performance/             # 領域横断のパフォーマンス計測基準・最適化手法
│   ├── performance-testing/     # k6負荷テスト・Lighthouse CI・LLMパフォーマンス計測
│   ├── testing-patterns/        # Test Double・テストデータビルダー・依存注入
│   ├── typescript/              # TypeScript固有の型設計パターン
│   ├── ui-design/                # プロダクショングレードUIの原則・アンチパターン
│   ├── docs-lookup/             # Tavily検索パターン
│   └── continuous-learning/     # セッションからの学習蓄積
│       ├── instincts/           # 自動抽出されたパターン（未精査）
│       └── curated/             # 確認済みベストプラクティス（定期鮮度チェック付き）
│           ├── agent-patterns.md    # LLMエージェント設計パターン（クロススタック）
│           ├── ai-security.md
│           ├── api-backend.md
│           ├── react.md
│           ├── testing.md
│           ├── typescript.md
│           └── ui-design.md
│
├── evals/                       # エージェント品質評価（/eval コマンドで使用）
│   ├── tasks/                   # タスク定義 YAML（git 管理）
│   └── results/                 # 実行結果 JSON（gitignore・ローカルのみ）
│
└── mcp-configs/
    └── mcp-servers.json         # MCPサーバー設定リファレンス
```

---

## スラッシュコマンド

| コマンド | 用途 |
|---|---|
| `/estimate` | RFP・要件メモを分析し工数・費用見積もりと提案書ドラフトを作成する（受注前） |
| `/domain` | 顧客業界のドメイン知識を収集・構造化する（要件定義の前段） |
| `/requirements` | 要件を精査・構造化して要件定義書を作成する |
| `/plan` | 実装計画を作成する（planner → architect → qa-engineer） |
| `/adr` | 技術選定の意思決定をADRとして記録する |
| `/test` | テスト戦略設計・実装・カバレッジ補完 |
| `/review` | コードレビュー（拡張子・パスから担当レビュアーを自動選択） |
| `/doc` | ドキュメント・READMEを生成・更新する |
| `/ship` | フォーマット→型チェック→テスト→レビュー→コミット→PRを一気に実行 |
| `/save` | 現在のセッションを手動保存する |
| `/learn` | 気づいたパターンをその場で instincts/ に記録する |
| `/curate` | instincts/ を精査して curated/ に昇格させる |
| `/eval [agent-name]` | エージェントの品質を定点観測（月1回の健診を推奨） |
| `/nippo [メモ]` | 当日の作業内容から日報を生成し Obsidian の `Daily/{案件名}/` に保存する |
| `/hanki-review [期間]` | 日報を期間・案件単位で集計し半期の自己評価レビュードラフトを作成する |

---

## 専門エージェント

### モデル選定ポリシー

| モデル | 用途 |
|---|---|
| Opus | 設計・判断・プロンプト設計（architect / planner / qa-engineer / domain-analyst / proposal-estimator / ai-agent-designer / ai-agent-implementer / ai-agent-reviewer） |
| Sonnet | 実装・レビュー・ドキュメント（それ以外） |

### エージェント一覧

**設計**
- `chief-of-staff` — 複数領域にまたがる大きなタスクの司令塔
- `proposal-estimator` — RFP分析・工数/費用見積もり・クライアント向け提案書ドラフト作成（受注前）
- `domain-analyst` — 顧客業界のドメイン知識収集・構造化（requirements-analyst の前段）
- `requirements-analyst` — 要件の精査・構造化・要件定義書作成
- `planner` — タスク分解・実装計画書作成（`docs/plans/` に保存）
- `architect` — 技術選定・ADR作成（`docs/adr/` に保存）
- `refactor-planner` — 技術的負債の解消計画策定
- `ai-agent-designer` — Mastra/LangChain/LlamaIndexエージェント設計

**実装**（各領域の実装を担当。test-implementer と並走）
- `frontend-implementer` — React / Next.js / Vue.js
- `backend-implementer` — Node.js / Python / PHP (Laravel) API
- `ios-implementer` — Swift / SwiftUI
- `android-implementer` — Kotlin / Jetpack Compose
- `3d-implementer` — Three.js / React Three Fiber / Unity
- `ai-agent-implementer` — Mastra / LangChain / LlamaIndex
- `fix-implementer` — バグ修正・既存コード修正・設定変更専門（言語自動検出・curated パターン適用）

**テスト**
- `qa-engineer` — テスト戦略設計・カバレッジ基準設定
- `test-implementer` — テスト実装・カバレッジ補完
- `e2e-implementer` — Playwright E2Eテスト（Page Object Model・CI統合）

**レビュー**（実装後に必ず通す。CRITICAL/HIGH は修正必須）
- `frontend-reviewer` (React/Next.js/Vue.js) / `backend-reviewer` (Node.js/Python/PHP) / `ios-reviewer` / `android-reviewer` / `3d-reviewer` / `ai-agent-reviewer`
- `security-auditor` — OWASP Top 10を網羅するセキュリティ横断レビュー
- `database-reviewer` — DBスキーマ・マイグレーション・クエリレビュー
- `architecture-reviewer` — 設計品質レビュー
- `qa-reviewer` — テスト戦略・実装レビュー
- `requirements-reviewer` / `plan-reviewer` / `adr-reviewer` — 各工程ドキュメントのレビュー
- `code-investigator` — バグ原因究明・影響範囲調査（read-only）

**ドキュメント・リリース・運用**
- `doc-writer` — オンボーディング・APIリファレンス生成
- `pr-author` — コミット前チェック・PR description生成（プロジェクト内にPRテンプレートがあれば優先使用）
- `observability-engineer` — OpenTelemetry・LGTM スタック・SLO設計

---

## 開発ワークフロー

### 受注前提案（RFP対応）

```
/estimate → RFP・要件メモを分析し工数・費用見積もりと提案書ドラフトを作成
            （単価未確定でも工数までは概算可能。単価はヒアリング必須）

提案承認 → 通常の「新機能の開発」フローへ（/requirements から開始）
```

### 新機能の開発

```
/domain  → （顧客業界の知識が必要な場合のみ）業界調査・用語集作成

/plan    → 実装計画書を作成
           └ 技術選定が必要なら自動で /adr も実行

/test    → テスト戦略を先に決める（qa-engineer）

実装開始 → *-implementer + test-implementer が並走
           実装完了時点でテストが揃っている状態が必須

/review  → 領域対応のレビュアーが自動起動
           CRITICAL / HIGH は修正してから次へ

/ship    → フォーマット → 型チェック → テスト → レビュー → コミット → PR
```

### バグ修正

```
/review <該当ファイル>  → 問題箇所を特定
再現テストを書く        → test-implementer
修正実装               → fix-implementer
/ship                  → コミット
```

---

## セッション管理

セッションの内容はプロジェクトごとに `.claude/sessions/` へ保存される。
保存は `/save` を実行したタイミングのみ（自動保存なし）。

```bash
# 手動保存（重要な決定をした時点で実行）
/save

# 重要なメモを添えて保存
/save ユーザー認証のアーキテクチャをJWTに決定
```

次回起動後、最初のプロンプト送信時に前回のセッション要約が1回だけ自動注入される（session-load hook）。

### パターン蓄積（continuous-learning）

`/save` でセッションを保存すると、Claude が会話を振り返り価値のあるパターンを `instincts/` に抽出する。
気づいた瞬間に残したい場合は `/learn <内容>` を使う。

週1程度で `/curate` を実行すると、instincts/ の未精査パターンを精査して `curated/` に昇格できる。
`curated/` のパターンはエージェントが実装・レビュー時に自動参照する。

各 curated ファイルには `review_after` フィールドがあり、`/curate` 実行時に期限切れのファイルを検出して再精査を促す（情報の陳腐化を防ぐ）。

### エージェント品質の定点観測（agent-eval）

`/eval` コマンドで特定エージェントを実際に動かし、YAML タスク定義の採点基準（pass/fail）で品質を測定する。
モデル更新後・エージェント定義変更後・動作に違和感を感じた時に月1程度で実行する。

```bash
/eval                        # タスク一覧を表示
/eval backend-implementer    # backend-implementer を全タスクで採点
/eval frontend-reviewer      # frontend-reviewer を全タスクで採点
```

タスク定義は `evals/tasks/*.yaml`（git管理）。採点結果は `evals/results/`（gitignore）に保存される。

---

## 個人用コマンド（Obsidian連携）

開発フローとは独立した、日々の業務ログ運用のためのコマンド。Obsidian vault の `Daily/{案件名}/` を参照・生成する。

- `/nippo [メモ]` — 現在の会話・作業内容から日報を生成して保存する。案件名はカレントディレクトリの git リポジトリ名から自動判定（非gitは `internal` 扱い）。作業の区切りで手動実行する。
- `/hanki-review [期間]` — `Daily/{案件名}/` 配下の日報を期間・案件単位で集計し、6項目の自己評価レビュードラフトを生成する。デフォルトは直近6ヶ月・全案件が対象。

---

## ルール

`rules/` 配下のファイルはすべてのプロジェクトで常時適用される。

| ファイル | 内容 |
|---|---|
| `principles.md` | 実装・レビューの行動原則（確認/シンプル/必要箇所のみ/推奨案/大変更確認/ゴール駆動） |
| `accountability.md` | 判断根拠の記録ルール（ADR・PR description・レビュー指摘フォーマット） |
| `testing.md` | カバレッジ基準（ビジネスロジック95% / API 90% / UI 80%） |
| `security.md` | APIキーハードコード禁止・入力バリデーション・認証認可 |
| `git.md` | ブランチ戦略・Conventional Commits・PRルール |
| `dependencies.md` | ライブラリ追加禁止・設計（ADR）の遵守 |
| `capability-surface-selection.md` | rules / skills / hooks / MCP の使い分け基準とルーティングフロー |

---

## カスタマイズ

### エージェントを追加する

`agents/<カテゴリ>/your-agent.md` を作成して以下のフォーマットで記述:

```markdown
---
name: your-agent
description: >
  エージェントの説明。
  どんな時に起動するかをここに書く。
tools: Read, Write, Bash, Grep, Glob
model: claude-sonnet-5
---

エージェントへの指示をここに書く。
```

### ルールを追加する

`rules/your-rule.md` を作成するだけで全プロジェクトに自動適用される。

### スラッシュコマンドを追加する

`commands/your-command.md` を作成:

```markdown
---
description: コマンドの説明
---

# /your-command

コマンドの実行内容をここに書く。
```

---

## 動作環境

- macOS / Linux
- Node.js 18+
- Claude Code（有料プラン推奨）
- Tavily APIキー（Web検索機能を使う場合）
