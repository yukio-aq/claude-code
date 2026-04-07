# Mastra v1.x Evented Workflow 実装ガイド

Mastra v1.21 + evented workflow を実際に動かすまでに直面したバグとその原因・修正を記録したリファレンスドキュメント。
「コードは書けたのに動かない」という状況になりやすい落とし穴が4つあり、それぞれ単体では気づきにくい。
このガイドを上から読み進めることで、別プロジェクトで同じ沼にハマらずに済む。

---

## 目次

1. [Evented Workflow を動かすための必須セットアップ（4つ揃えて初めて動く）](#1-evented-workflow-を動かすための必須セットアップ4つ揃えて初めて動く)
   - [1-1. `mastra.startEventEngine()` を必ず呼ぶ](#1-1-mastrastartevengineengine-を必ず呼ぶ)
   - [1-2. ワークフロー登録キーは workflow の `id` と一致させる](#1-2-ワークフロー登録キーは-workflow-の-id-と一致させる)
   - [1-3. `WorkflowsInMemory` ストレージを必ず設定する](#1-3-workflowsinmemory-ストレージを必ず設定する)
   - [1-4. `@ai-sdk/google` の環境変数名は `GOOGLE_GENERATIVE_AI_API_KEY`](#1-4-ai-sdkgoogle-の環境変数名は-google_generative_ai_api_key)
2. [Mastra Tool の正しい直接呼び出し方（Mastra v1.x）](#2-mastra-tool-の正しい直接呼び出し方mastra-v1x)
3. [Evented Workflow の内部動作（デバッグ時の思考の地図）](#3-evented-workflow-の内部動作デバッグ時の思考の地図)
4. [デバッグチェックリスト](#4-デバッグチェックリスト)
5. [最小動作テンプレート](#5-最小動作テンプレート)
6. [KEIBA-AI プロジェクト固有の実装メモ](#6-keiba-ai-プロジェクト固有の実装メモ)

---

## 動作確認済み環境

| パッケージ | バージョン |
| :--- | ---: |
| `@mastra/core` | 1.21.0 |
| `@ai-sdk/google` | 3.0.56 |
| `ai` | 6.0.144 |

---

## 1. Evented Workflow を動かすための必須セットアップ（4つ揃えて初めて動く）

以下の4点がすべて揃わないと、ワークフローは動かない。どれか1つ欠けてもエラーになるか、**エラーも出ずに静かに止まる**。

---

### 1-1. `mastra.startEventEngine()` を必ず呼ぶ

> **なぜ必要か**
>
> Mastra の evented workflow は内部的に pubsub（EventEmitter ベース）を使って各ステップを連鎖させる。`startEventEngine()` を呼ぶまで "workflows" チャンネルにサブスクライバーが存在しない。そのため `run.start()` が `pubsub.publish("workflows", ...)` を発行しても誰も受け取らず、Promise が永遠に resolve しない。

**欠けたときの症状**

- `await run.start()` がハングし、レスポンスが返ってこない
- タイムアウトエラーになるまで気づかない
- ログにも何も出ない（publish は成功しているが、受信者がいないだけ）

**正しい実装**（`.then()` チェーンで順番を保証する）

```typescript
// src/index.ts
import { mastra } from './agents';
import { serve } from '@hono/node-server';

// startEventEngine() を先に完了させてからサーバーを起動する
mastra.startEventEngine().then(() => {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  });
});
```

`serve()` の中で呼ぶのではなく、`.then()` チェーンで順番を保証することがポイント。

---

### 1-2. ワークフロー登録キーは workflow の `id` と一致させる

> **なぜ必要か**
>
> Mastra は `new Mastra({ workflows: { [key]: workflowInstance } })` で登録されたキーを使って、イベント受信時にワークフローを引き当てる。`WorkflowEventProcessor.process()` の中で `workflows[event.workflowId]` として参照するため、登録キーと `createWorkflow({ id: '...' })` で指定した `id` が一致していないと見つからない。

**欠けたときの症状**

- `"Workflow with ID xxx not found"` というエラーが内部ログに出力される
- `run.start()` がエラーで終了するか、ハングする

**正しい実装**（登録キーと `id` を揃える）

```typescript
// workflows/predict-workflow.ts
export const predictWorkflow = createWorkflow({
  id: 'predict-workflow',   // ← このIDを
  // ...
});

// agents/index.ts
export const mastra = new Mastra({
  workflows: {
    'predict-workflow': predictWorkflow,  // ← 登録キーと一致させる
  },
  // ...
});
```

命名規則: ワークフロー `id` はケバブケース（例: `predict-workflow`）で統一しておくと、登録キーと見比べやすい。

---

### 1-3. `WorkflowsInMemory` ストレージを必ず設定する

> **なぜ必要か**
>
> evented workflow は各ステップの実行結果をストレージに書き込み、次のステップ開始時にそこから読み出す。ストレージが設定されていないと `processWorkflowStepEnd()` 内の `updateWorkflowResults()` が `undefined` を返す。この関数の直後に `if (!newStepResults) return;` という早期リターンがあるため、**1ステップ目が終わった直後に処理が静かに停止する**。

**欠けたときの症状**

- 1ステップ目のログは出る
- 2ステップ目以降のログが一切出ない
- エラーも例外も発生しない（最も厄介なパターン）
- `run.start()` は eventually resolve するが、結果が空か不完全

**正しい実装**（`domains.workflows` にストレージを渡す）

```typescript
// agents/index.ts
import { Mastra } from '@mastra/core';
import { EventEmitterPubSub } from '@mastra/core/events';
import { MastraStorage, WorkflowsInMemory, InMemoryDB } from '@mastra/core/storage';

const storage = new MastraStorage({
  id: 'app-inmemory',
  domains: {
    workflows: new WorkflowsInMemory({ db: new InMemoryDB() }),
  },
});

export const mastra = new Mastra({
  workflows: {
    'predict-workflow': predictWorkflow,
  },
  pubsub: new EventEmitterPubSub(),
  storage,
});
```

**注意点**

このストレージはワークフローのステップ間状態管理専用であり、アプリケーションのデータベース（SQLite / PostgreSQL 等）とは別物。Drizzle ORM で管理している `predictions` テーブル等とは無関係。混同しないこと。

---

### 1-4. `@ai-sdk/google` の環境変数名は `GOOGLE_GENERATIVE_AI_API_KEY`

> **なぜ必要か**
>
> `@ai-sdk/google` パッケージは内部で `process.env.GOOGLE_GENERATIVE_AI_API_KEY` を参照する。この変数名はパッケージ側で固定されており、変更できない。

**欠けたときの症状**

- Gemini API が "API key not found" / "API key missing" エラーで失敗する
- `google('gemini-2.5-flash')` の呼び出し自体は通るが、実際のリクエスト時にエラーになる

**正しい `.env` の設定**

```bash
# .env

# 誤: 自分で名前をつけたカスタム変数（@ai-sdk/google は参照しない）
GEMINI_API_KEY=your_key_here

# 正: @ai-sdk/google が内部で参照する変数名
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

Tavily の変数名は自由だが、`@ai-sdk/google` の変数名だけは固定なので注意。

---

## 2. Mastra Tool の正しい直接呼び出し方（Mastra v1.x）

Workflow Step の `execute` 関数内から `createTool` で定義した Tool を直接呼び出す際のシグネチャが、バージョン間で変わっている。

### ✗ 旧シグネチャ（Mastra 0.x）

```typescript
// Mastra 0.x 系の書き方。v1.x では動かない
const result = await (tavilySearchTool as any).execute({
  context: { query: '東京競馬場 2026-04-07' },
  runId: '',
  mastra: undefined,
});
```

**何が起きるか**: `inputData` が `context` プロパティに入っているため、Tool 内の `execute(input)` で受け取る引数が `{ context: { query: '...' } }` になる。Tool の Zod スキーマは `{ query: string }` を期待しているため、`input.query` が `undefined` になる。その結果、Tavily API に空のクエリが送られてハングまたはエラーになる。

### ✓ 正しいシグネチャ（Mastra v1.x）

```typescript
// Mastra v1.x の書き方: execute(inputData, context) の2引数シグネチャ
const result = await tavilySearchTool.execute!(
  { query: '東京競馬場 2026-04-07' },
  {} as any,  // ToolContext（Mastra内部用）。直接呼び出し時は空で可
);
```

**なぜこうなるか**: Mastra v1.x の `createTool` は `execute(input: TInput, context: ToolContext)` というシグネチャに変更された。第1引数がそのままバリデーション・実行される。

---

## 3. Evented Workflow の内部動作（デバッグ時の思考の地図）

「どこで止まっているか」を特定するために、内部でどのようにイベントが流れるかを理解しておく。

```
run.start()
  └── EventedExecutionEngine.execute()
        ├── pubsub.subscribe("workflows-finish", finishCb)
        │   // finishCb が resolve するまで待つ
        └── pubsub.publish("workflows", { type: "workflow.start", workflowId })
                          ↓ EventEmitter.emit() で同期呼び出し
                     workflowEventCb（Mastra 内部に登録済み）
                       └── WorkflowEventProcessor.process()
                             └── processWorkflowStart()
                                   └── pubsub.publish("workflows", { type: "workflow.step.run" })
                                                     ↓
                                              processWorkflowStepRun()
                                                └── StepExecutor.execute(step)
                                                      └── step.execute({ inputData })
                                                            // ここでユーザーコードが動く
                                                └── pubsub.publish("workflows", { type: "workflow.step.end" })
                                                                  ↓
                                                           processWorkflowStepEnd()
                                                             └── updateWorkflowResults()
                                                             │   // ← ストレージ必須。なければここで return
                                                             └── pubsub.publish("workflows", { type: "workflow.step.run" })
                                                                               // 次ステップへ（繰り返し）
                                                           ...（ステップ数だけ繰り返す）
                                                           └── endWorkflow()
                                                                 └── pubsub.publish("workflows-finish", result)
                                                                                   ↓
                                                                            finishCb が resolve
run.start() が返る
```

**このフロー図を使ったデバッグ方法**

`run.start()` がハングしているとき、どの `pubsub.publish()` まで到達しているかをログで追う。`processWorkflowStart` まで到達しているかどうか（1-1、1-2の問題）と、`processWorkflowStepEnd` の後に次ステップに進んでいるか（1-3の問題）を切り分けられる。

---

## 4. デバッグチェックリスト

同じ問題に当たったとき、以下の順番で確認する。

### `run.start()` がハングして返ってこない場合

| # | 確認項目 |
| :---: | :--- |
| 1 | `mastra.startEventEngine()` をサーバー起動前に呼んでいるか |
| 2 | `new Mastra({ workflows: { [key]: ... } })` の登録キーと `createWorkflow({ id: '...' })` の `id` が一致しているか |
| 3 | ログに `"Workflow with ID xxx not found"` が出ていないか（出ていれば 2 が原因） |
| 4 | `pubsub: new EventEmitterPubSub()` を `new Mastra(...)` に渡しているか |

### 1ステップ目は完了したのに2ステップ目以降が動かない場合

| # | 確認項目 |
| :---: | :--- |
| 1 | `WorkflowsInMemory` ストレージを設定しているか（設定なし = エラーなし・静かに停止） |
| 2 | ストレージの `domains.workflows` に `new WorkflowsInMemory({ db: new InMemoryDB() })` が入っているか |

### Tool の `execute` 内で入力値が `undefined` になる場合

| # | 確認項目 |
| :---: | :--- |
| 1 | Tool の呼び出しシグネチャが `execute!(inputData, {} as any)` の2引数形式になっているか |
| 2 | `execute({ context: inputData })` という旧形式になっていないか |

### Gemini API が "API key missing" で失敗する場合

| # | 確認項目 |
| :---: | :--- |
| 1 | `.env` に `GOOGLE_GENERATIVE_AI_API_KEY` が設定されているか（`GEMINI_API_KEY` ではない） |
| 2 | `.env` ファイルが `dotenv` / `@hono/node-server` によって読み込まれているか |

---

## 5. 最小動作テンプレート

上記の4点をすべて満たした最小構成。新規プロジェクトでの起点として使う。

```typescript
// src/agents/index.ts
import { Mastra } from '@mastra/core';
import { EventEmitterPubSub } from '@mastra/core/events';
import { MastraStorage, WorkflowsInMemory, InMemoryDB } from '@mastra/core/storage';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

// ---- Step 定義 ----
const step1 = createStep({
  id: 'step-1',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ inputData }) => {
    return { result: `processed: ${inputData.message}` };
  },
});

const step2 = createStep({
  id: 'step-2',
  inputSchema: z.object({ result: z.string() }),
  outputSchema: z.object({ final: z.string() }),
  execute: async ({ inputData }) => {
    return { final: `done: ${inputData.result}` };
  },
});

// ---- Workflow 定義 ----
export const myWorkflow = createWorkflow({
  id: 'my-workflow',   // ← 登録キーと一致させる
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ final: z.string() }),
})
  .then(step1)
  .then(step2)
  .commit();

// ---- Mastra インスタンス ----
const storage = new MastraStorage({
  id: 'app-inmemory',
  domains: {
    workflows: new WorkflowsInMemory({ db: new InMemoryDB() }),
  },
});

export const mastra = new Mastra({
  workflows: {
    'my-workflow': myWorkflow,  // ← workflow の id と一致させる
  },
  pubsub: new EventEmitterPubSub(),
  storage,
});
```

```typescript
// src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { mastra, myWorkflow } from './agents';

const app = new Hono();
const port = 3000;

app.post('/run', async (c) => {
  const run = mastra.createWorkflowRun('my-workflow');
  const result = await run.start({ inputData: { message: 'hello' } });
  return c.json({ success: true, data: result });
});

// startEventEngine() を必ず先に完了させる
mastra.startEventEngine().then(() => {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  });
});
```

```bash
# .env
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
```

---

## 6. KEIBA-AI プロジェクト固有の実装メモ

このセクションは KEIBA-AI 固有の補足。

### Tavily Tool の直接呼び出しパターン

```typescript
// agents/collect-info/step.ts
import { tavilySearchTool } from '../tools/tavily-search';

// Step の execute 内での正しい呼び出し
const searchResult = await tavilySearchTool.execute!(
  { query: `${venue} ${raceDate} 出馬表` },
  {} as any,
);
```

### predict-workflow の登録キー

```typescript
// agents/index.ts
export const mastra = new Mastra({
  workflows: {
    'predict-workflow': predictWorkflow,   // id: 'predict-workflow' と一致
    'verify-workflow': verifyWorkflow,     // id: 'verify-workflow' と一致
  },
  // ...
});
```

### Gemini API 呼び出しはワークフローのステップ内で直接行う

ADR-001 の決定通り、Mastra Agent の LLM 推論は使わず、ステップ内で `generateText()` を直接呼ぶ。これにより Gemini の呼び出し回数が完全に予測可能になる。

```typescript
// agents/generate-prediction/step.ts
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { google } from '@ai-sdk/google';

// GOOGLE_GENERATIVE_AI_API_KEY が .env に設定されていれば自動で認証される
const { output } = await generateText({
  model: google('gemini-2.5-flash'),
  output: Output.object({ schema: PredictionOutputSchema }),
  prompt: buildPredictionPrompt(raceInfo),
});
```
