---
description: エージェントの品質を定点観測する。YAML タスク定義に基づいてエージェントを実際に動かし、judge 基準で採点する。
---

# /eval

`evals/tasks/` のタスクを使ってエージェントを実際に動かし、品質を採点する。

## 使い方

```
/eval                        # 利用可能なタスク一覧を表示
/eval backend-implementer    # 特定エージェントのタスクを全て実行
/eval frontend-reviewer
```

## 実行手順

**Step 1**: タスクファイルを取得する。

```bash
ls ~/desktop/claude-code/evals/tasks/*.yaml 2>/dev/null | sort
```

`$ARGUMENTS` が指定されている場合は、ファイル名に `$ARGUMENTS` を含むものだけを対象にする。
引数なしで、かつタスクが1件もない場合は「`evals/tasks/` にタスクがありません。SKILL.md を参照してタスクを作成してください。」と伝えて終了。
引数なしでタスクがある場合は一覧を表示して終了する:

```
利用可能なタスク:
  backend-implementer: {タスク名} ({description})
  frontend-reviewer:   {タスク名} ({description})

実行例: /eval backend-implementer
```

**Step 2**: 対象タスクファイルを Read で読み込む。

YAML フィールドの意味:
- `name`: タスク識別名
- `agent`: 実行対象のエージェント名
- `description`: タスクの説明
- `setup`: 実行前に作成する一時ファイル（任意）
- `working_dir`: エージェントに渡すコンテキストのディレクトリ（任意）
- `prompt`: エージェントへの指示
- `judge`: 採点基準（配列）

**Step 3**: setup があれば実行する。

Bash で `setup` に定義されたファイルを作成する。`path` に `{tmpdir}` が含まれる場合は `/tmp/eval-{name}` に置換する。

**Step 4**: エージェントを実際に動かす。

Task ツールで対象エージェントを起動する。

```
目的: agent-eval タスク「{name}」の品質検証
タスク: {prompt}
作業ディレクトリ: {working_dir または setup で作成したディレクトリ}
制約: 通常通りに実装してください。eval であることを意識する必要はありません。
出力: 実装を完了させること
```

エージェントの完了を待つ。

**Step 5**: judge 基準で採点する。

judge タイプごとに Bash または Read で確認し、各項目を pass / fail で判定する。

| タイプ | 確認方法 |
|---|---|
| `grep` | `grep -E "{pattern}" {file}` の終了コードが 0 → pass |
| `not_grep` | `grep -E "{pattern}" {file}` の終了コードが 1（マッチなし）→ pass |
| `file_exists` | `[ -f {path} ]` → pass |
| `test` | `{command}` の終了コードが 0 → pass |
| `llm_judge` | 対象ファイルを Read して、prompt の基準で自分（Claude）が pass/fail を判定する |

**Step 6**: 結果をレポートする。

```
## /eval 結果: {agent-name}

### {task-name}
{description}

| 採点項目 | 結果 | 詳細 |
|---|---|---|
| {description} | ✅ pass / ❌ fail | {あれば補足} |

**総合: {pass件数}/{judge件数} — {PASS / FAIL}**

---

### サマリー
✅ PASS: {件数}件
❌ FAIL: {件数}件

{FAILがある場合}
改善提案:
- {judge の description と具体的な問題点}
```

**Step 7**: 結果を `evals/results/` に保存する。

```bash
TODAY=$(date +%Y-%m-%d)
echo '{結果のJSON}' > ~/desktop/claude-code/evals/results/${TODAY}-{agent-name}.json
```

JSON の最小フォーマット:
```json
{
  "date": "2026-06-19",
  "agent": "backend-implementer",
  "tasks": [
    {
      "name": "...",
      "total": 3,
      "passed": 3,
      "verdict": "PASS"
    }
  ]
}
```
