---
description: 現在のセッションを保存する。重要な決定をした・作業の区切りがついた・終了前に残しておきたいときに使う。
---

# /save

現在のセッションを手動で保存する。

## 使い方
/save
/save <メモ>

## 例
/save
/save 認証機能の設計が完了
/save 次回はテスト実装から再開

## 実行内容

以下のBashコマンドを実行する:

```bash
# 引数なしの場合
node ~/desktop/claude-code/hooks/session-save.js

# メモがある場合（例: /save 認証機能の設計が完了）
node ~/desktop/claude-code/hooks/session-save.js "認証機能の設計が完了"
```

## 保存内容
- 作業概要（会話の要約）
- 決定事項（技術選定・設計判断）
- デバッグログ・エラー解決過程
- 次回の開始ポイント・未完了タスク
- メモ（渡した場合は次回の開始ポイントに追記）

## 保存先
```
your-project/.claude/sessions/YYYY-MM-DDThh-mm-ss.md
（latest.md が常に最新を指す）
```

## 使い分け
- **自動保存**: セッション終了時（Stop hook）に自動で実行される
- **手動保存（このコマンド）**: 重要な決定の直後・作業の区切り・終了前など任意のタイミングで実行する