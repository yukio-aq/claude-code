# 活用ガイド — Claude Code テックリード設定

このファイルでは、セットアップ完了後の具体的な使い方・活用パターンを解説する。
セットアップ手順は [README.md](README.md) を参照。

---

## 目次

1. [基本的な使い方](#基本的な使い方)
2. [スラッシュコマンド早見表](#スラッシュコマンド早見表)
3. [開発シナリオ別ガイド](#開発シナリオ別ガイド)
4. [専門エージェントの呼び出し方](#専門エージェントの呼び出し方)
5. [セッション管理](#セッション管理)
6. [パターン蓄積（continuous-learning）](#パターン蓄積continuous-learning)
7. [エージェント品質の定点観測（agent-eval）](#エージェント品質の定点観測agent-eval)
8. [カスタマイズ方法](#カスタマイズ方法)
9. [よくある使い方のヒント](#よくある使い方のヒント)

---

## 基本的な使い方

### Claude Code を起動する

```bash
cd <プロジェクトのディレクトリ>
claude
```

プロジェクトのルートで起動すると、`~/.claude/` に配置された設定が自動的に全プロジェクトに適用される。

### エージェントへの指示の基本

シンプルな質問・依頼はそのまま自然言語で入力するだけでよい。  
複雑なタスクのときは、下記の **シナリオ別ガイド** を参考にコマンドやエージェントを使い分ける。

### 前回セッションの引き継ぎ

最初のプロンプトを送信したタイミングで、前回セッションの要約が自動的に注入される。  
何も設定せず、前回どこまで何をやったかを自動的に引き継いだ状態で会話を始められる。

---

## スラッシュコマンド早見表

Claude Code のチャット欄で `/` を入力すると一覧が出る。

| コマンド | 何をするか | いつ使うか |
|---|---|---|
| `/estimate` | RFP・要件メモを分析し工数・費用見積もりと提案書ドラフトを作成 | 受注前・見積もり依頼を受けたとき |
| `/requirements` | 要件を精査・構造化して要件定義書を作成 | 要件が曖昧なとき・複数人で認識を揃えたいとき |
| `/plan` | 実装計画書を作成（技術選定が必要なら ADR も作成） | 新機能の実装前に必ず |
| `/adr` | 技術選定の意思決定を ADR として記録 | ライブラリ・アーキテクチャを決定したとき |
| `/test` | テスト戦略設計・実装・カバレッジ補完 | テストを追加・強化したいとき |
| `/review` | コードレビュー（拡張子から担当を自動選択） | 実装後・PR 作成前に必ず |
| `/doc` | ドキュメント・README を生成・更新 | オンボーディング資料や API リファレンスを作りたいとき |
| `/ship` | フォーマット → 型チェック → テスト → レビュー → コミット → PR を一気に実行 | 実装が完成してコミットする前 |
| `/save` | 現在のセッションを手動保存 | 重要な決定をした直後・作業を中断する前 |
| `/learn <内容>` | 気づいたパターンをその場で instincts/ に記録 | ベストプラクティスに気づいた瞬間 |
| `/curate` | instincts/ を精査して curated/ に昇格 | 週1程度・知見が溜まったタイミングで |
| `/eval [agent-name]` | エージェントの品質を YAML タスクで採点 | モデル更新後・動作に違和感を感じたとき（月1推奨） |

---

## 開発シナリオ別ガイド

### 新機能を開発する（フルフロー）

```
① 要件が曖昧な場合のみ
   /requirements
   → 要件定義書（requirements.md）が docs/ に生成される

② 実装計画を立てる
   /plan
   → 実装計画書（plan.md）が docs/plans/ に生成される
   → 技術選定が必要なら自動で ADR も作成される

③ テスト戦略を先に決める
   /test
   → qa-engineer がテストケース一覧と戦略を設計する

④ 実装する
   「〇〇を実装してください」と指示する
   → 拡張子・コンテキストから適切な *-implementer が起動する
   → test-implementer が並走してテストを書く

⑤ コードレビュー
   /review
   → 拡張子・パスから担当レビュアーが自動で起動する
   → CRITICAL / HIGH の指摘は必ず修正してから次へ進む

⑥ コミット・PR 作成
   /ship
   → フォーマット確認 → 型チェック → テスト実行 → レビュー → コミット → PR description 生成
```

### バグを修正する

```
① 問題箇所を特定する
   /review <該当ファイルのパス>

② 再現テストを書いてから修正する
   「このバグの再現テストを書いて、修正してください」

③ コミットする
   /ship
```

### 技術的負債を解消する

```
① 解消計画を立てる
   「refactor-planner に技術的負債の解消計画を作ってもらう」

② 計画に基づき実装する
   「計画に従って*-implementer でリファクタしてください」

③ レビュー・コミット
   /review → /ship
```

### セキュリティを確認する

```
「security-auditor にこのディレクトリのセキュリティレビューをしてもらう」
→ OWASP Top 10 を基準にした横断レビューが行われる
→ CRITICAL / HIGH の指摘は即修正する
```

### 大きくて複雑なタスクを任せる

```
「chief-of-staff に <やりたいこと> を任せてください」
→ タスクを分解して適切なエージェントに自動で委譲する
```

---

## 専門エージェントの呼び出し方

エージェントは「エージェント名 + やってもらいたいこと」で呼び出す。  
明示しなくても、コンテキストから自動的に適切なエージェントが選ばれることが多い。

### 呼び出しの例

```
# 設計
「architect に Next.js と Remix のトレードオフを整理して ADR を作成してもらう」
「planner にこの要件定義書を元に実装計画書を作成してもらう」
「requirements-analyst にこのユーザーストーリーを精査してもらう」

# 実装
「frontend-implementer でこのコンポーネントを実装してください（TypeScript + Tailwind / Vue 3）」
「backend-implementer でユーザー登録 API を実装してください（PHP/Laravel 13）」
「ai-agent-implementer で Mastra や LlamaIndex を使ったワークフローを実装してください」

# テスト
「qa-engineer でテスト戦略を設計してください。カバレッジ基準も提示してください」
「test-implementer でこのファイルのカバレッジを 90% 以上にしてください」
「e2e-implementer でログインフローの Playwright テストを書いてください」

# レビュー
「backend-reviewer でこの PR の変更点をレビューしてください」
「database-reviewer でこのマイグレーションをレビューしてください」
「security-auditor で認証周りをレビューしてください」

# ドキュメント・リリース
「doc-writer でこの API のリファレンスドキュメントを作成してください」
「pr-author でコミットメッセージと PR description を作成してください」
「observability-engineer で OpenTelemetry のトレーシング設計をしてください」

# 見積もり・提案（受注前）
「proposal-estimator でこの RFP を分析して工数と費用を見積もってください」
```

### モデル選定（コスト最適化）

| モデル | 対象エージェント |
|---|---|
| **Opus**（高精度・高コスト） | architect / planner / qa-engineer / ai-agent-designer / ai-agent-implementer / ai-agent-reviewer / requirements-analyst / domain-analyst / proposal-estimator |
| **Sonnet**（標準・推奨） | それ以外の実装・レビュー・ドキュメント系 |

---

## セッション管理

### 手動保存

重要な決定をした後や、作業を中断する前に実行する。

```
/save

# メモを添えて保存する場合（次回起動時に引き継がれる）
/save ユーザー認証は JWT + リフレッシュトークン方式に決定
```

保存先: プロジェクトの `.claude/sessions/` ディレクトリ

### セッションの自動引き継ぎ

次回の Claude Code 起動後、最初のプロンプトを送信した瞬間に前回セッションの要約が自動注入される（`session-load` hook）。  
手動操作は不要。

### 保存のタイミングの目安

- アーキテクチャや技術選定を決定したとき
- 大きな実装フェーズが完了したとき
- 長い作業セッションを中断するとき

---

## パターン蓄積（continuous-learning）

### 何ができるか

複数回のセッションを重ねると、繰り返し使われるパターンや判断基準が蓄積される。  
`/save` 実行時に Claude がセッションを振り返り、価値のあるパターンを自動抽出する。

### パターンの「昇格」フロー

```
実装中に気づいたこと
   ↓ /learn <内容>  または  /save（セッション区切り）
instincts/（未精査のパターン）
   ↓ /curate（週1程度）
curated/（確認済みベストプラクティス）
   ↓ エージェントが参照
```

`curated/` のパターンは次回からエージェントが自動的に参照するため、チームの知見が蓄積されていく。

### curated/ の鮮度管理

各 curated ファイルには `review_after` フロントマターが設定されており、`/curate` 実行時に期限切れを自動検出する。

```yaml
---
last_updated: 2026-05-09
confidence: high
review_after: 2026-11-09
---
```

期限を過ぎたファイルが検出されると、最新情報との照合・更新が促される。  
ライブラリやフレームワークのベストプラクティスは半年〜1年で変わるため、この仕組みで陳腐化を防ぐ。

---

## エージェント品質の定点観測（agent-eval）

### 何ができるか

`/eval` コマンドで特定エージェントに合成タスクを与え、YAML 定義の採点基準（grep / llm_judge 等）でスコアを測定する。  
エージェントが期待通りに動いているか、数値で把握できる。

### 基本的な使い方

```
/eval                        # タスク一覧を表示（タスクがある場合）
/eval backend-implementer    # backend-implementer の全タスクを実行して採点
/eval frontend-reviewer      # frontend-reviewer の全タスクを実行して採点
/eval security-auditor       # security-auditor の全タスクを実行して採点
```

### いつ実行するか

| タイミング | 理由 |
|---|---|
| モデルアップデート後 | モデル変更で挙動が変わることがある |
| エージェント定義を変更したとき | 修正が意図した改善になっているか確認 |
| 「あのエージェント最近おかしい？」と感じたとき | 直感を数値で確認 |
| 月1回の定期健診 | 品質の経時変化を記録 |

### タスク定義ファイルの構成

```yaml
# evals/tasks/backend-implementer-basic.yaml
name: backend-implementer-basic
agent: backend-implementer
description: REST エンドポイントを型安全・バリデーション付きで実装できるか

setup:           # エージェントに渡す初期ファイル（/tmp/eval-{name}/ に展開）
prompt:          # エージェントへの指示
judge:           # 採点基準（grep / not_grep / file_exists / test / llm_judge）
```

現在のタスク一覧:
- `backend-implementer-{basic,security,error-handling}` — API実装3種
- `frontend-implementer-{basic,hooks,form}` — コンポーネント実装3種
- `backend-reviewer-{n-plus-one,security,error-handling}` — レビュー観点3種
- `frontend-reviewer-{basic,performance}` — レビュー観点2種
- `security-auditor-{injection,auth}` — セキュリティ検出2種

---

## カスタマイズ方法

### 独自エージェントを追加する

`agents/<カテゴリ>/your-agent.md` を作成する。

```markdown
---
name: your-agent
description: >
  エージェントの説明。
  どんなとき・どのように起動するかをここに書く。
tools: Read, Write, Bash, Grep, Glob
model: claude-sonnet-5
---

エージェントへの指示をここに書く。
```

### 独自ルールを追加する

`rules/your-rule.md` を作成するだけで全プロジェクトに自動適用される。

```markdown
---
description: ルールの説明
---

# ルールのタイトル

ルールの内容をここに書く。
```

### 独自スキルを追加する

`skills/<カテゴリ>/SKILL.md` を作成して、エージェントが参照するドメイン知識を記述する。  
エージェントの定義側で `<skill>` タグを指定すると、そのエージェントが実行時に読み込む。

### 独自スラッシュコマンドを追加する

`commands/your-command.md` を作成する。

```markdown
---
description: コマンドの説明
---

# /your-command

コマンドの実行内容をここに書く。
```

---

## よくある使い方のヒント

### コンテキストを渡すと精度が上がる

エージェントへの指示に「なぜ必要か」を添えると、判断の精度が上がる。

```
❌「ユーザー登録 API を実装してください」
✅「モバイルアプリのユーザー登録フローのためにユーザー登録 API を実装してください。
   メールアドレス + パスワードで登録し、JWT を返す仕様です。」
```

### 成果物はファイルに書き出すよう指示する

エージェントの出力をファイルに残しておくと、次のエージェントへの引き継ぎがスムーズになる。

```
「実装計画書を docs/plans/feature-xxx.md に書き出してください」
「ADR を docs/adr/0001-auth.md に保存してください」
```

### 複数領域にまたがる場合は chief-of-staff から始める

フロントエンド・バックエンド・インフラなど複数領域にまたがるタスクは、最初に `chief-of-staff` に委譲するとタスク分解と担当割り当てを自動でやってくれる。

### /review に対象ファイルを明示する

`/review` はすべてのファイルを対象にするより、変更したファイルを絞って渡すと精度・速度が上がる。

```
/review src/features/auth/
```

### /ship の前に /review を挟む

`/ship` 内で自動レビューも走るが、CRITICAL / HIGH の指摘を修正した後に `/ship` を実行するのが理想的なフロー。

---

## ルールのリファレンス

常時適用されるルールの概要:

| ファイル | 主なルール |
|---|---|
| `rules/principles.md` | 実装・レビューの6つの行動原則（悪例/良例付き） |
| `rules/accountability.md` | 判断根拠の記録方法・レビュー指摘フォーマット |
| `rules/testing.md` | カバレッジ基準（ビジネスロジック 95% / API 90% / UI 80%）・テスト命名規則 |
| `rules/security.md` | APIキーのハードコード禁止・入力バリデーション・認証認可チェック |
| `rules/git.md` | ブランチ戦略・Conventional Commits・PRルール |
| `rules/dependencies.md` | ライブラリ追加禁止ルール・設計（ADR）遵守 |
| `rules/capability-surface-selection.md` | rules / skills / hooks / MCP の使い分けフロー |
