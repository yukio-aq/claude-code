---
name: mastra
description: >
  Mastra v1.x Evented Workflow の実装パターン・落とし穴・デバッグ手順。
  ai-agent-implementer / ai-agent-reviewer が Mastra ワークフローを
  実装・レビューするときに参照する。
---

# Mastra v1.x — Evented Workflow 実装スキル

> 情報収集日: 2026-03-31
> 詳細なガイド（コード例・フロー図付き）は `skills/frameworks/mastra/guide.md` を参照。

---

## 必須セットアップ（4点すべて揃えること）

### 1. `mastra.startEventEngine()` をサーバー起動前に呼ぶ

```typescript
// NG: startEventEngine() なしで serve() を呼ぶ → run.start() が永遠にハング
mastra.startEventEngine().then(() => {
  serve({ fetch: app.fetch, port });
});
```

**欠けているときの症状**: `run.start()` がハングして返らない。ログに何も出ない。

### 2. 登録キーと `createWorkflow` の `id` を一致させる

```typescript
export const predictWorkflow = createWorkflow({ id: 'predict-workflow', ... });

export const mastra = new Mastra({
  workflows: {
    'predict-workflow': predictWorkflow, // ← id と完全一致
  },
});
```

**欠けているときの症状**: `"Workflow with ID xxx not found"` エラー。または `run.start()` がハング。

### 3. `WorkflowsInMemory` ストレージを設定する

```typescript
import { MastraStorage, WorkflowsInMemory, InMemoryDB } from '@mastra/core/storage';

const storage = new MastraStorage({
  id: 'app-inmemory',
  domains: {
    workflows: new WorkflowsInMemory({ db: new InMemoryDB() }),
  },
});

export const mastra = new Mastra({
  workflows: { ... },
  pubsub: new EventEmitterPubSub(),
  storage, // ← 必須
});
```

**欠けているときの症状**: 1ステップ目は完了するが、2ステップ目以降が**エラーなしで静かに停止**する。最も気づきにくいバグ。

### 4. 環境変数名は `GOOGLE_GENERATIVE_AI_API_KEY`

```bash
# NG
GEMINI_API_KEY=...

# OK（@ai-sdk/google がこの名前を固定で参照する）
GOOGLE_GENERATIVE_AI_API_KEY=...
```

---

## Tool の直接呼び出しシグネチャ（v1.x）

```typescript
// NG: Mastra 0.x の旧シグネチャ → input.query が undefined になる
await tool.execute({ context: { query }, runId: "", mastra: undefined });

// OK: Mastra v1.x の正しいシグネチャ
await tool.execute!(
  { query }, // 第1引数: inputData（そのままZodでバリデーションされる）
  {} as any, // 第2引数: ToolContext（直接呼び出し時は空でよい）
);
```

---

## デバッグチェックリスト

| 症状                                    | 確認すること                                                                                       |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------- |
| `run.start()` がハング                  | `startEventEngine()` を先に呼んでいるか。登録キーと `id` が一致しているか。`pubsub` を渡しているか |
| 2ステップ目以降が動かない（エラーなし） | `WorkflowsInMemory` ストレージを設定しているか                                                     |
| Tool の入力値が `undefined`             | `execute!(inputData, {} as any)` の2引数形式を使っているか                                         |
| Gemini API が "key missing"             | `.env` に `GOOGLE_GENERATIVE_AI_API_KEY` が設定されているか                                        |

---

## レビュー観点（ai-agent-reviewer 向け）

Mastra evented workflow のコードを見るときは以下を確認する。

- [ ] `mastra.startEventEngine()` が `serve()` より先に呼ばれているか
- [ ] `workflows` の登録キーと `createWorkflow({ id })` の値が一致しているか
- [ ] `new Mastra(...)` に `pubsub: new EventEmitterPubSub()` が渡されているか
- [ ] `new Mastra(...)` に `storage`（`WorkflowsInMemory`）が渡されているか
- [ ] Tool の直接呼び出しが `execute!(inputData, {} as any)` の形式になっているか
- [ ] `.env` の API キー名が `GOOGLE_GENERATIVE_AI_API_KEY` になっているか
