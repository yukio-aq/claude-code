---
name: orchestration
description: マルチエージェント並列実行・品質ゲートループ・判断記録のオーケストレーションパターン。Workflow ツールを使う大規模タスクで chief-of-staff が参照する。
when_to_use:
  - Workflow ツールで複数エージェントをファンアウトさせるとき
  - 品質ゲートを満たすまでループさせたいとき
  - エージェントの判断理由を連鎖的に記録したいとき
  - 並列実行できるタスクを自動判定したいとき
not_for:
  - 単一エージェントで完結するタスク（chief-of-staffで十分）
  - 3ファイル未満の小規模変更
last_updated: 2026-06-19
---

# オーケストレーションパターン

Workflow ツールを使ったマルチエージェント構成のパターン集。

---

## parallel-execution-optimizer

### 目的
タスクリストから依存関係を解析し、並列実行できるものを自動的に分離する。

### パターン

```typescript
// Workflow スクリプトでの使い方
const tasks = [
  { id: 'design', deps: [] },
  { id: 'frontend', deps: ['design'] },
  { id: 'backend', deps: ['design'] },   // frontend と backend は並列実行可
  { id: 'review', deps: ['frontend', 'backend'] },
]

// 依存なし = 並列実行
const phase1 = tasks.filter(t => t.deps.length === 0)  // ['design']
// 全依存が完了 = 次のフェーズ
const phase2 = tasks.filter(t => t.deps.every(d => completedIds.has(d)))  // ['frontend', 'backend']
```

### 判断基準
- 成果物が独立している（出力ファイルが重複しない）
- 入力として必要なファイルが既に存在する
- 同一ファイルを同時に編集しない

---

## benchmark-optimization-loop

### 目的
品質ゲート（テスト・型チェック・レビュー）をパスするまでループする。最大試行回数で無限ループを防ぐ。

### パターン

```typescript
// Workflow スクリプト
const MAX_ATTEMPTS = 3
let attempt = 0

while (attempt < MAX_ATTEMPTS) {
  attempt++
  const impl = await agent(`実装してください: ${task}`, { phase: 'Implement' })
  
  const review = await agent(
    `このコードをレビューしてください。APPROVED か NEEDS_REVISION を返してください:\n${impl}`,
    { schema: REVIEW_SCHEMA, phase: 'Review' }
  )
  
  if (review.verdict === 'APPROVED') break
  
  // フィードバックを次の試行に渡す
  task = `前回の指摘: ${review.feedback}\n元のタスク: ${task}`
}
```

### 停止条件
- `APPROVED` が返ったとき
- `MAX_ATTEMPTS` に達したとき（ユーザーに手動確認を促す）

---

## recursive-decision-ledger

### 目的
エージェントチェーンで「なぜこの判断をしたか」を連鎖的に記録する。後から意思決定を追跡できる。

### パターン

```typescript
// 各エージェントの判断に理由を付与させる
const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    decision: { type: 'string' },
    rationale: { type: 'string' },  // なぜこの判断をしたか
    alternatives_considered: {       // 検討した代替案
      type: 'array',
      items: { type: 'string' }
    },
    confidence: { type: 'number' }  // 0.0 〜 1.0
  }
}

const designDecision = await agent(
  'どの設計パターンを選ぶか決めてください。rationale と alternatives_considered を必ず含めてください。',
  { schema: DECISION_SCHEMA, phase: 'Design' }
)

// 次のエージェントに文脈を渡す
const impl = await agent(
  `設計判断: ${designDecision.decision}\n理由: ${designDecision.rationale}\nこの設計に基づいて実装してください。`,
  { phase: 'Implement' }
)
```

### 活用場面
- ADR を自動生成したいとき
- レビューエージェントに「なぜこの設計か」の文脈を渡したいとき
- 後から判断の根拠を追えるようにしたいとき

---

## adversarial-verify

### 目的
N人の独立した懐疑的なエージェントが「この発見は本当か？」を反証しようとする。多数決で生存した発見だけを採用する。

### パターン

```typescript
// 1件の発見に対して3つの独立した反証エージェントを立てる
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },  // 反証できたか
    reason: { type: 'string' }
  }
}

const votes = await parallel(
  Array.from({ length: 3 }, (_, i) => () =>
    agent(
      `以下の発見を反証しようとしてください。デフォルトは refuted=true です:\n${finding}`,
      { schema: VERDICT_SCHEMA, label: `verify-${i}`, phase: 'Verify' }
    )
  )
)

// 2/3 以上が「反証できない」なら採用
const survives = votes.filter(Boolean).filter(v => !v.refuted).length >= 2
```

### 使いどころ
- セキュリティ脆弱性の発見（誤検知コストが高い）
- アーキテクチャ問題の指摘（大規模変更のトリガーになる）
- バグ原因の特定（誤った修正を防ぐ）

---

## ノート

- pipeline() は壁なし並列（途中でバリアを張らない）→ ほとんどのケースで使う
- parallel() は壁あり（全エージェントの完了を待つ）→ 全結果が揃わないと次に進めないときだけ
- エージェント数上限: 1ワークフローあたり最大 1000 エージェント（実用上は 16 並列まで同時実行）
