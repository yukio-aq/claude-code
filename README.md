# Claude Code — テックリード向け個人設定

Claude Code をテックリードとして使い倒すための設定・エージェント・ワークフロー集。

26個の専門エージェント・8つのスラッシュコマンド・自動化フックで、
設計からコミットまでの開発フローを自動化する。

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
├── agents/                      # 専門エージェント定義（26個）
│   ├── orchestration/
│   │   └── chief-of-staff.md        # 大きなタスクの司令塔
│   ├── design/
│   │   ├── requirements-analyst.md  # 要件定義書作成
│   │   ├── planner.md               # 実装計画作成
│   │   ├── architect.md             # 技術選定・ADR作成
│   │   ├── refactor-planner.md      # 技術的負債解消計画
│   │   └── ai-agent-designer.md     # AIエージェント設計（Mastra/LangChain/LlamaIndex）
│   ├── implement/
│   │   ├── frontend-implementer.md
│   │   ├── backend-implementer.md
│   │   ├── ios-implementer.md
│   │   ├── android-implementer.md
│   │   ├── 3d-implementer.md
│   │   └── ai-agent-implementer.md   # AIエージェント実装（Mastra/LangChain/LlamaIndex）
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
│   │   ├── security-auditor.md      # セキュリティ横断レビュー
│   │   └── database-reviewer.md     # DBスキーマ・クエリレビュー
│   ├── docs/
│   │   └── doc-writer.md            # ドキュメント生成
│   ├── release/
│   │   └── pr-author.md             # コミット前チェック・PR作成
│   └── ops/
│       └── observability-engineer.md # OpenTelemetry・SLO設計
│
├── commands/                    # スラッシュコマンド（8個）
│   ├── requirements.md          # /requirements
│   ├── plan.md                  # /plan
│   ├── adr.md                   # /adr
│   ├── test.md                  # /test
│   ├── review.md                # /review
│   ├── doc.md                   # /doc
│   ├── ship.md                  # /ship
│   └── save.md                  # /save
│
├── hooks/                       # 自動化スクリプト（4個）
│   ├── session-save.js          # セッション保存（/save コマンドから手動呼び出し）
│   ├── session-load.js          # 前回セッションを初回プロンプト時に1回だけ注入（UserPromptSubmit hook）
│   ├── format-check.js          # ファイル変更後にフォーマット確認（PostToolUse hook）
│   └── pre-commit-guard.js      # main直接pushを防止（PreToolUse hook）
│
├── rules/                       # 常時適用ルール（5個）
│   ├── api-design.md            # API設計・レスポンス形式
│   ├── testing.md               # テスト方針・カバレッジ基準
│   ├── security.md              # セキュリティ禁止事項
│   ├── git.md                   # ブランチ戦略・コミット規約
│   └── performance.md           # パフォーマンス計測基準
│
├── skills/                      # ドメイン知識・ベストプラクティス
│   ├── ai-agent-patterns/       # Mastra/LangChain/LlamaIndex設計パターン
│   ├── architecture/            # ADRテンプレート・システム設計・技術選定
│   ├── coding-standards/        # 領域別コーディング規約（frontend/backend/ios/android/3D）
│   ├── docs-lookup/             # Tavily検索パターン
│   └── continuous-learning/     # セッションからの学習蓄積
│       ├── extract.js           # パターン抽出スクリプト
│       ├── instincts/           # 自動抽出されたパターン
│       └── curated/             # 確認済みベストプラクティス
│
└── mcp-configs/
    └── mcp-servers.json         # MCPサーバー設定リファレンス
```

---

## スラッシュコマンド

| コマンド | 用途 |
|---|---|
| `/requirements` | 要件を精査・構造化して要件定義書を作成する |
| `/plan` | 実装計画を作成する（planner → architect → qa-engineer） |
| `/adr` | 技術選定の意思決定をADRとして記録する |
| `/test` | テスト戦略設計・実装・カバレッジ補完 |
| `/review` | コードレビュー（拡張子・パスから担当レビュアーを自動選択） |
| `/doc` | ドキュメント・READMEを生成・更新する |
| `/ship` | フォーマット→型チェック→テスト→レビュー→コミット→PRを一気に実行 |
| `/save` | 現在のセッションを手動保存する |

---

## 専門エージェント

### モデル選定ポリシー

| モデル | 用途 |
|---|---|
| Opus | 設計・判断・プロンプト設計（architect / planner / qa-engineer / ai-agent-designer / ai-agent-implementer / ai-agent-reviewer） |
| Sonnet | 実装・レビュー・ドキュメント（それ以外） |

### エージェント一覧

**設計**
- `chief-of-staff` — 複数領域にまたがる大きなタスクの司令塔
- `requirements-analyst` — 要件の精査・構造化・要件定義書作成
- `planner` — タスク分解・実装計画書作成（`docs/plans/` に保存）
- `architect` — 技術選定・ADR作成（`docs/adr/` に保存）
- `refactor-planner` — 技術的負債の解消計画策定
- `ai-agent-designer` — Mastra/LangChain/LlamaIndexエージェント設計

**実装**（各領域の実装を担当。test-implementer と並走）
- `frontend-implementer` — React / Next.js
- `backend-implementer` — Node.js / Python / PHP (Laravel) API
- `ios-implementer` — Swift / SwiftUI
- `android-implementer` — Kotlin / Jetpack Compose
- `3d-implementer` — Three.js / React Three Fiber / Unity
- `ai-agent-implementer` — Mastra / LangChain / LlamaIndex

**テスト**
- `qa-engineer` — テスト戦略設計・カバレッジ基準設定
- `test-implementer` — テスト実装・カバレッジ補完
- `e2e-implementer` — Playwright E2Eテスト（Page Object Model・CI統合）

**レビュー**（実装後に必ず通す。CRITICAL/HIGH は修正必須）
- `frontend-reviewer` / `backend-reviewer` (Node.js/Python/PHP) / `ios-reviewer` / `android-reviewer` / `3d-reviewer` / `ai-agent-reviewer`
- `security-auditor` — OWASP Top 10を網羅するセキュリティ横断レビュー
- `database-reviewer` — DBスキーマ・マイグレーション・クエリレビュー

**ドキュメント・リリース・運用**
- `doc-writer` — オンボーディング・APIリファレンス生成
- `pr-author` — コミット前チェック・PR description生成
- `observability-engineer` — OpenTelemetry・LGTM スタック・SLO設計

---

## 開発ワークフロー

### 新機能の開発

```
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
修正実装               → *-implementer
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

### パターン抽出（continuous-learning）

セッションが蓄積されたら、繰り返し使われるパターンを抽出できる:

```bash
node ~/Desktop/claude-code/skills/continuous-learning/extract.js
```

`instincts/` に自動抽出されたパターンが保存される。
内容を確認して確かなものだけ `curated/` に昇格させると、エージェントが次回から参照する。

---

## ルール

`rules/` 配下のファイルはすべてのプロジェクトで常時適用される。

| ファイル | 内容 |
|---|---|
| `api-design.md` | レスポンス統一エンベロープ・HTTPステータス・エラーコード命名 |
| `testing.md` | カバレッジ基準（ビジネスロジック95% / API 90% / UI 80%） |
| `security.md` | APIキーハードコード禁止・入力バリデーション・認証認可 |
| `git.md` | ブランチ戦略・Conventional Commits・PRルール |
| `performance.md` | LCP 2.5秒・INP 100ms・API p95 500ms・60fps |

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
model: claude-sonnet-4-6
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
