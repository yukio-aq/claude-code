---
name: tanstack-query
description: >
  TanStack Query v5 のベストプラクティス・デフォルト挙動・実装パターン。
  frontend-implementer / frontend-reviewer が React でサーバーデータを
  扱う実装・レビューをするときに参照する。
---

# TanStack Query v5 — ベストプラクティス

> 情報収集日: 2026-08-05 / TanStack Query v5 ベース
> 公式ドキュメント: https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

---

## デフォルト挙動（必ず把握しておく）

TanStack Query はデフォルトで **アグレッシブな再フェッチ** を行う。知らないと意図しない挙動に見える。

| 設定                   | デフォルト値 | 意味                                              |
| :--------------------- | :----------- | :------------------------------------------------ |
| `staleTime`            | `0`          | キャッシュは即座に stale になる（常に古いと判断） |
| `gcTime`               | `5分`        | 非アクティブなクエリは5分後にキャッシュから破棄   |
| `retry`                | `3`          | 失敗時は指数バックオフで3回リトライ               |
| `refetchOnMount`       | `true`       | コンポーネントのマウント時に再フェッチ            |
| `refetchOnWindowFocus` | `true`       | ウィンドウにフォーカスが戻ると再フェッチ          |
| `refetchOnReconnect`   | `true`       | ネットワーク再接続時に再フェッチ                  |

### `staleTime` の設定指針

```typescript
// デフォルト（staleTime: 0）— 毎回再フェッチが走る。頻繁に変わるデータ向け

// 2分間はキャッシュを使い再フェッチしない
staleTime: 2 * 60 * 1000;

// 手動で invalidate するまで永遠にキャッシュを使う
staleTime: Infinity;

// invalidateQueries も無視して絶対に再フェッチしない（起動時に1回だけ取るデータ向け）
// 例: 機能フラグ、ログイン時のパーミッション、静的マスターデータ
staleTime: "static";
```

> `Infinity` と `'static'` の違い: `queryClient.invalidateQueries()` は `Infinity` には効くが `'static'` には効かない。

---

## queryOptions ヘルパー（v5 推奨パターン）

`queryKey` と `queryFn` を1箇所に集約して型安全にする。v5 の最重要パターン。

```typescript
// queries/groups.ts
import { queryOptions } from "@tanstack/react-query";
import { fetchGroup, fetchGroups } from "../api/groups";

export const groupQueries = {
  all: () =>
    queryOptions({
      queryKey: ["groups"],
      queryFn: fetchGroups,
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: ["groups", id],
      queryFn: () => fetchGroup(id),
      staleTime: 5 * 60 * 1000,
    }),
};

// コンポーネント・プリフェッチ・invalidate すべてで再利用できる
useQuery(groupQueries.detail(1));
useSuspenseQuery(groupQueries.detail(5));
queryClient.prefetchQuery(groupQueries.detail(23));
queryClient.invalidateQueries({ queryKey: groupQueries.detail(1).queryKey });

// select で派生データも型安全に
const name = useQuery({
  ...groupQueries.detail(1),
  select: (data) => data.groupName, // data の型は queryFn の戻り値から推論される
});
```

---

## Query Key 設計規則

```typescript
// ✅ 正しい設計: ドメイン → リソース → 絞り込み の階層構造
["todos"][("todos", todoId)][("todos", todoId, { preview: true })][ // 一覧 // 個別 // 個別 + オプション
  ("todos", { status: "done" })
]; // フィルタ付き一覧

// ✅ クエリ関数が使う変数はすべて queryKey に含める
function Todos({ status }: { status: string }) {
  useQuery({
    queryKey: ["todos", { status }], // status が変わると自動で再フェッチ
    queryFn: () => fetchTodos(status),
  });
}

// ❌ オブジェクト内のキー順序は関係ない（同一視される）
(["todos", { status, page }] ===
  ["todos", { page, status }][ // 同じ
    // ❌ 配列の順序は関係ある（別クエリとして扱われる）
    ("todos", status, page)
  ]) !==
  ["todos", page, status];
```

**大規模アプリでは Query Key Factory パターンを使う:**

```typescript
// queryKeys.ts — キーを1ファイルで集中管理
export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: TodoFilters) => [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: number) => [...todoKeys.details(), id] as const,
}

// 使用例
useQuery({ queryKey: todoKeys.detail(todoId), queryFn: ... })
queryClient.invalidateQueries({ queryKey: todoKeys.lists() }) // 全リストを一括無効化
```

---

## Mutation パターン

### 基本

```typescript
const mutation = useMutation({
  mutationFn: (newTodo: NewTodo) => api.createTodo(newTodo),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["todos"] });
  },
  onError: (error) => {
    toast.error(error.message);
  },
});

// 呼び出し側
mutation.mutate({ title: "Buy milk" });

// await が必要なとき（try/catch で囲む）
await mutation.mutateAsync({ title: "Buy milk" });
```

### ライフサイクルコールバック

```typescript
useMutation({
  mutationFn: updateTodo,
  onMutate: async (variables) => {
    // ミューテーション直前のスナップショットを返す（楽観的更新のロールバック用）
    await queryClient.cancelQueries({ queryKey: ["todos"] });
    const previous = queryClient.getQueryData(["todos"]);
    queryClient.setQueryData(["todos"], (old) => [...old, variables]); // 楽観的更新
    return { previous };
  },
  onError: (error, variables, context) => {
    // ロールバック
    queryClient.setQueryData(["todos"], context?.previous);
  },
  onSettled: () => {
    // 成功・失敗にかかわらず最後に実行
    queryClient.invalidateQueries({ queryKey: ["todos"] });
  },
});
```

### `mutate` vs `mutateAsync`

|                              | `mutate`                   | `mutateAsync`                |
| :--------------------------- | :------------------------- | :--------------------------- |
| 戻り値                       | `void`                     | `Promise<data>`              |
| エラー処理                   | `onError` で受け取る       | `try/catch` で受け取る       |
| コンポーネントアンマウント後 | コールバックが実行されない | Promise は解決される         |
| 推奨シーン                   | 通常のUI操作               | Promise チェーンが必要なとき |

---

## よくある落とし穴

### `staleTime: 0` で画面遷移のたびにフェッチが走る

```typescript
// ❌ 毎回フェッチが走る（デフォルト）
useQuery({ queryKey: ["user"], queryFn: fetchUser });

// ✅ 5分はキャッシュから返す
useQuery({ queryKey: ["user"], queryFn: fetchUser, staleTime: 5 * 60 * 1000 });

// ✅ グローバルデフォルトで設定するほうが管理しやすい
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000 }, // 全クエリのデフォルトを1分に
  },
});
```

### `QueryClient` をコンポーネント外で作る

```typescript
// ❌ レンダリングのたびに新しい QueryClient が作られる
function App() {
  const queryClient = new QueryClient() // NG
  return <QueryClientProvider client={queryClient}>...</QueryClientProvider>
}

// ✅ モジュールスコープまたは useState/useRef で安定させる（ESLint: stable-query-client）
const queryClient = new QueryClient() // モジュールスコープ
function App() {
  return <QueryClientProvider client={queryClient}>...</QueryClientProvider>
}
```

### 依存変数を `queryKey` に含め忘れる

```typescript
// ❌ userId が変わっても再フェッチされない
useQuery({
  queryKey: ["user"], // userId が入っていない
  queryFn: () => fetchUser(userId),
});

// ✅
useQuery({
  queryKey: ["user", userId], // userId を含める
  queryFn: () => fetchUser(userId),
});
```

---

## ESLint プラグイン（`@tanstack/eslint-plugin-query`）

導入必須。上記の落とし穴の多くを静的に検出できる。

```bash
npm install -D @tanstack/eslint-plugin-query
```

| ルール                 | 検出内容                                       |
| :--------------------- | :--------------------------------------------- |
| `exhaustive-deps`      | queryKey に依存変数が漏れている                |
| `stable-query-client`  | `QueryClient` がコンポーネント内で作られている |
| `no-unstable-deps`     | queryKey に不安定な参照が含まれている          |
| `prefer-query-options` | `queryOptions()` ヘルパーを使うよう促す        |

---

## レビュー観点（frontend-reviewer 向け）

- [ ] `QueryClient` がモジュールスコープまたは安定した参照で作られているか
- [ ] `queryOptions()` ヘルパーを使って `queryKey` と `queryFn` が共通化されているか
- [ ] `queryKey` にクエリ関数が使う変数がすべて含まれているか
- [ ] `staleTime` が意図的に設定されているか（デフォルト `0` のまま放置していないか）
- [ ] Mutation の後に `invalidateQueries` または `setQueryData` でキャッシュを更新しているか
- [ ] `@tanstack/eslint-plugin-query` が導入されているか
