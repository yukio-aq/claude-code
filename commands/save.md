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

**Step 4**: パターン抽出を実行する。

```bash
node ~/desktop/claude-code/skills/continuous-learning/extract.js --dir "$PROJECT_ROOT"
```

抽出結果（カテゴリ・件数）を表示する。エラーが出た場合はスキップしてその旨を表示する。

**Step 5**: 完了メッセージを出力する。

```
✅ Session saved → {SESSION_FILE_PATH}
```
