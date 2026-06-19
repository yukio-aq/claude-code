---
name: agent-eval
description: エージェントのアウトプット品質を定点観測する。YAML タスク定義を使ってパスレート・一貫性を計測し、モデル更新やエージェント定義変更後の品質劣化を検出する。qa-engineer / test-implementer が参照する。
when_to_use:
  - モデルアップデート後にエージェント品質が変わっていないか確認するとき
  - エージェント定義を変更した後に品質回帰を検出するとき
  - 「このエージェントは本当に機能しているか」をデータで確かめたいとき
not_for:
  - ユニット・統合テスト（testing-patternsを使う）
  - 実装コードのバグ修正
  - E2Eテスト（playwright-e2e.mdを使う）
last_updated: 2026-06-19
---

# Agent Eval

エージェントのアウトプット品質を定点観測する軽量評価フレームワーク。

## コンセプト

「このエージェントは正しく動いているか？」をデータで答える。感覚ではなく、再現可能なタスクとパスレートで品質を管理する。

## タスク定義（YAML）

`evals/tasks/` 以下に置く。1 ファイル = 1 タスク。

```yaml
# evals/tasks/backend-implementer-crud.yaml
name: backend-crud-endpoint
agent: backend-implementer
description: CRUDエンドポイントを正しく実装できるか

prompt: |
  /users エンドポイントに以下を実装してください:
  - GET /users  → ユーザー一覧（ページネーション付き）
  - POST /users → ユーザー作成（Zod バリデーション）
  - 400/404 エラーハンドリング

judge:
  # テストが通るか
  - type: test
    command: npx vitest run tests/users.test.ts
  # 必要なパターンが実装されているか
  - type: grep
    pattern: "z\\.object|ZodError"
    files: src/routes/users.ts
  # セキュリティアンチパターンがないか
  - type: not_grep
    pattern: "any\\b"
    files: src/routes/users.ts

runs: 3  # 一貫性確認のため複数回実行
```

## 実行方法

```bash
# 単一タスクを実行
node evals/run.js --task evals/tasks/backend-implementer-crud.yaml

# 全タスクを実行
node evals/run.js --all

# 特定エージェントのタスクのみ
node evals/run.js --agent backend-implementer
```

## 判定基準

| メトリクス | 説明 | 基準 |
|---|---|---|
| パスレート | judge 全項目を通過した割合 | 90%以上 |
| 一貫性 | 複数回実行でのパスレートの安定性 | 3/3 = 100% |
| コスト | 1タスクあたりの API コスト | 記録のみ |

## ディレクトリ構成

```
evals/
├── tasks/          # タスク定義 YAML
│   ├── backend-implementer-crud.yaml
│   ├── frontend-implementer-component.yaml
│   └── ...
├── results/        # 実行結果（git ignore 推奨）
│   └── {date}-{task}.json
└── run.js          # 実行スクリプト（最小実装は手動でも可）
```

## 最小実装（手動版）

自動化する前に、まず手動で定期実行するだけでも価値がある:

1. `evals/tasks/` に気になるエージェントのタスク YAML を書く
2. 月1回（モデル更新後・エージェント定義変更後）に手動実行
3. 結果を `evals/results/` に JSON で保存
4. 劣化があれば エージェント定義を修正

## judge タイプ

| タイプ | 説明 |
|---|---|
| `test` | コマンドを実行してゼロ終了コードを確認 |
| `grep` | ファイルにパターンが存在することを確認 |
| `not_grep` | ファイルにパターンが存在しないことを確認 |
| `file_exists` | ファイルが作成されていることを確認 |
| `llm_judge` | LLM に判定させる（主観的品質の評価用） |

## llm_judge の使い方

```yaml
judge:
  - type: llm_judge
    prompt: |
      以下のコードを評価してください。
      評価基準: TypeScript の型安全性・エラーハンドリング・可読性
      出力: {"pass": true/false, "reason": "..."}
    file: src/routes/users.ts
    pass_condition: '"pass": true'
```

## 注意事項

- Git worktree で隔離して実行すると再現性が高まる（並列実行も可能）
- `results/` は `.gitignore` に追加する（トークンコスト情報が含まれる場合）
- タスク定義は `evals/tasks/` ごと git 管理して品質変化を追跡する
