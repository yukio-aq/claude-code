---
description: 現在のセッションを保存する。重要な決定をした・作業の区切りがついた・終了前に残しておきたいときに使う。
---

# /save

現在の会話内容を要約してセッションファイルに書き出す。

## 引数
`$ARGUMENTS` にメモが渡された場合は「次回の開始ポイント」の先頭に追記する。

## 実行手順

**Step 1**: 保存パスを Bash で確定する。

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
SESSION_ID=$(date +%Y-%m-%dT%H-%M-%S)
mkdir -p "$PROJECT_ROOT/.claude/sessions"
echo "SESSION_DIR=$PROJECT_ROOT/.claude/sessions"
echo "SESSION_ID=$SESSION_ID"
```

**Step 2**: 現在の会話を要約し、Write ツールで以下のフォーマットでファイルに保存する。

保存先: `{PROJECT_ROOT}/.claude/sessions/{SESSION_ID}.md`

```markdown
# Session: {SESSION_ID}

> 保存日時: {現在の日時（日本語ロケール）}
> メッセージ数: ユーザー {n}件 / Claude {n}件
{メモがある場合のみ: > メモ: {$ARGUMENTS}}

---

## 作業概要
{この会話で扱ったタスク・議論を3〜5行で要約する}

---

## 決定事項
{技術選定・設計方針・採用した実装アプローチ等を箇条書き。なければ「（なし）」}

---

## デバッグログ・エラー解決過程
{発生したエラーと解決過程を記録。なければ「（なし）」}

---

## 次回の開始ポイント
{$ARGUMENTS のメモを先頭に記載し、続いて未完了タスク・TODOを箇条書き。なければ「（なし）」}
```

**Step 3**: `latest.md` シンボリックリンクを Bash で更新する。

```bash
ln -sf "{SESSION_FILE_PATH}" "{SESSION_DIR}/latest.md"
```

**Step 4**: このセッションの会話を振り返り、具体的なパターンを **0〜3件** 厳選して instincts/ に記録する。

### 記録する基準（すべて満たすもの）

- 具体的なコード例が書けるパターン・アンチパターン
- 複数プロジェクトに適用できる汎用性がある
- 既存の `curated/patterns.md` / `curated/anti-patterns.md` にまだ載っていない

### 記録しない（積極的にスキップ）

- このプロジェクト固有の実装詳細やバグ修正
- ハーネス（claude-code リポジトリ）の設定変更
- 抽象的すぎてコードに落とせないもの
- 「〜を採用した」「〜に決めた」という意思決定のみで、パターンとして成立しないもの

**ゼロ件でよい。** 質より量は不要。価値のあるものだけ記録する。

### カテゴリ判定

| キーワード | カテゴリ |
|---|---|
| テスト・test・vitest・jest・playwright・カバレッジ | `testing` |
| API・エンドポイント・endpoint・レスポンス・Zod | `api-design` |
| アーキテクチャ・設計・レイヤー・分割・責務 | `architecture` |
| セキュリティ・認証・認可・auth・token・JWT | `security` |
| パフォーマンス・最適化・N+1・キャッシュ・遅い | `performance` |
| コミット・branch・PR・マージ | `git` |
| エージェント・agent・LLM・プロンプト・Mastra | `ai-agent` |
| 上記以外 | `general` |

### 書き込み先と形式

パス: `{PROJECT_ROOT}/skills/continuous-learning/instincts/{TODAY}-{category}.md`

ファイルが存在する場合は Read して `## パターン` セクションの末尾に1行追記。
存在しない場合は Write で新規作成:

```markdown
---
title: {category} パターン
confidence: 0.8
source: /save（Claude抽出）
last_seen: {TODAY}
---

## パターン

- {パターン内容}
```

抽出件数を表示する（0件の場合は「新規パターンなし」と表示）。

**Step 5**: 完了メッセージを出力する。

```
✅ Session saved → {SESSION_FILE_PATH}
```
