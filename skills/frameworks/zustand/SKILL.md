---
name: zustand
description: >
  Zustand のベストプラクティス・TypeScript パターン・Slices 設計。
  frontend-implementer / frontend-reviewer がクライアント状態管理を
  実装・レビューするときに参照する。
  ※ サーバーデータの取得・キャッシュには TanStack Query を使う。Zustand はクライアント状態専用。
---

# Zustand — ベストプラクティス

> 情報収集日: 2026-04-07 / Zustand v5 ベース
> 公式ドキュメント: https://zustand.docs.pmnd.rs/

---

## Zustand の使い所（TanStack Query との役割分担）

| 種類                                                       | 使うもの           |
| :--------------------------------------------------------- | :----------------- |
| サーバーデータ（API レスポンス・キャッシュ）               | **TanStack Query** |
| クライアント状態（UI 状態・フォーム・モーダル・選択中 ID） | **Zustand**        |

Zustand で API キャッシュを管理しない。TanStack Query が役割を担う。

---

## 基本パターン（TypeScript）

```typescript
// ✅ TypeScript では create<T>()(...) のカリー形式を使う
import { create } from "zustand";

interface BearState {
  bears: number;
  increase: (by: number) => void;
  reset: () => void;
}

const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  increase: (by) => set((state) => ({ bears: state.bears + by })),
  reset: () => set({ bears: 0 }),
}));
```

> `create<T>()(...)` の二重カッコは TypeScript の型推論に必要。`create<T>(...)` ではなく `create<T>()(...)` と書く。

---

## セレクターで再レンダリングを最小化する

**必ずセレクターでプリミティブ値を取り出す。** ストア全体を subscribe すると、どのプロパティが変わっても再レンダリングが走る。

```typescript
// ❌ ストア全体を取得 → 何かが変わるたびに再レンダリング
const state = useBearStore();

// ✅ 必要な値だけ取り出す
const bears = useBearStore((state) => state.bears);
const increase = useBearStore((state) => state.increase);
```

### 複数の値を同時に取り出す場合は `useShallow`

セレクターが配列・オブジェクトを返すと、毎回新しい参照が生成されて再レンダリングが走る。`useShallow` でシャロー比較に切り替える。

```typescript
import { useShallow } from "zustand/react/shallow";

// ❌ Object.keys() は毎回新しい配列を返す → 常に再レンダリング
const names = useMealsStore((state) => Object.keys(state));

// ✅ useShallow でシャロー比較
const names = useMealsStore(useShallow((state) => Object.keys(state)));

// ✅ 複数プロパティをまとめて取り出すときも useShallow
const { bears, fishes } = useBoundStore(
  useShallow((state) => ({ bears: state.bears, fishes: state.fishes })),
);
```

---

## アクションの配置方針

### 推奨: ストア内にコロケーション（デフォルト）

```typescript
// ✅ 状態とアクションを一緒に置く（自己完結型で管理しやすい）
const useTodoStore = create<TodoState>()((set) => ({
  todos: [],
  addTodo: (todo) => set((state) => ({ todos: [...state.todos, todo] })),
  removeTodo: (id) =>
    set((state) => ({ todos: state.todos.filter((t) => t.id !== id) })),
}));
```

### 代替: モジュールレベルにアクションを分離

フックなしでアクションを呼べる、コード分割しやすい、という利点がある。

```typescript
export const useTodoStore = create<TodoState>()(() => ({
  todos: [],
}));

// フックの外からでも呼べる
export const addTodo = (todo: Todo) =>
  useTodoStore.setState((state) => ({ todos: [...state.todos, todo] }));

export const removeTodo = (id: string) =>
  useTodoStore.setState((state) => ({
    todos: state.todos.filter((t) => t.id !== id),
  }));
```

---

## Slices パターン（ストアが大きくなったとき）

ストアが肥大化したら機能単位で Slice に分割し、1つの `useBoundStore` に合成する。

```typescript
// stores/bearSlice.ts
import { StateCreator } from "zustand";

interface BearSlice {
  bears: number;
  addBear: () => void;
}

export const createBearSlice: StateCreator<
  BearSlice & FishSlice, // 全体の型（スライス間で参照が必要な場合）
  [],
  [],
  BearSlice
> = (set) => ({
  bears: 0,
  addBear: () => set((state) => ({ bears: state.bears + 1 })),
});

// stores/fishSlice.ts
interface FishSlice {
  fishes: number;
  addFish: () => void;
}

export const createFishSlice: StateCreator<
  BearSlice & FishSlice,
  [],
  [],
  FishSlice
> = (set) => ({
  fishes: 0,
  addFish: () => set((state) => ({ fishes: state.fishes + 1 })),
});

// stores/index.ts — 合成する
import { create } from "zustand";

export const useBoundStore = create<BearSlice & FishSlice>()((...a) => ({
  ...createBearSlice(...a),
  ...createFishSlice(...a),
}));
```

> ミドルウェア（`persist`, `devtools`）は合成後のストアにのみ適用する。個別スライスに適用すると予期しない問題が起きる。

---

## ミドルウェア

### devtools（開発時）

```typescript
import { devtools } from "zustand/middleware";

const useBearStore = create<BearState>()(
  devtools(
    (set) => ({
      bears: 0,
      increase: (by) => set((s) => ({ bears: s.bears + by })),
    }),
    { name: "BearStore" }, // Redux DevTools に表示される名前
  ),
);
```

### persist（LocalStorage に永続化）

```typescript
import { persist } from "zustand/middleware";

const useSettingsStore = create<SettingsState>()(
  persist((set) => ({ theme: "light", setTheme: (theme) => set({ theme }) }), {
    name: "settings-storage", // localStorage のキー名
    partialize: (state) => ({ theme: state.theme }), // 永続化するプロパティを限定
  }),
);
```

### ミドルウェアの順序

```typescript
// devtools は最後に置く（内側のミドルウェアが setState を変更した後に適用させる）
create<State>()(
  devtools(
    persist(
      immer((set) => ({ ... })),
      { name: 'my-store' }
    )
  )
)
```

### ネストした状態の更新に Immer を使う

```typescript
import { immer } from "zustand/middleware/immer";

const useStore = create<State>()(
  immer((set) => ({
    deep: { nested: { count: 0 } },
    // ❌ スプレッド地獄
    // increment: () => set((s) => ({ deep: { ...s.deep, nested: { ...s.deep.nested, count: s.deep.nested.count + 1 } } }))
    // ✅ Immer でミュータブルに書く
    increment: () =>
      set((state) => {
        state.deep.nested.count++;
      }),
  })),
);
```

---

## よくある落とし穴

### ストア全体の subscribe で不要な再レンダリング

```typescript
// ❌ ストア全体を取得 → 毎回再レンダリング
const { bears, increase } = useBearStore();

// ✅ それぞれセレクターで取り出す
const bears = useBearStore((state) => state.bears);
const increase = useBearStore((state) => state.increase);
```

### 複数の `setState` を連続で呼ぶとバッチされない（React 18 以外）

```typescript
// ❌ 2回 setState が走る
const reset = () => {
  useBearStore.setState({ bears: 0 });
  useFishStore.setState({ fishes: 0 });
};

// ✅ 1つのストアにまとめるか、React 18 の自動バッチングに任せる
```

### `persist` で関数を保存しない

```typescript
// ❌ 関数は JSON シリアライズできないので永続化されない
persist((set) => ({ count: 0, increment: () => set(...) }), { name: 'store' })

// ✅ partialize で状態のみ永続化する
persist(
  (set) => ({ count: 0, increment: () => set(...) }),
  { name: 'store', partialize: (state) => ({ count: state.count }) }
)
```

---

## レビュー観点（frontend-reviewer 向け）

- [ ] サーバーデータを Zustand で管理していないか（TanStack Query を使うべき）
- [ ] TypeScript で `create<T>()()` のカリー形式を使っているか
- [ ] コンポーネントがセレクターで必要な値だけ取り出しているか（ストア全体を取ってしまっていないか）
- [ ] 配列・オブジェクトを返すセレクターに `useShallow` が使われているか
- [ ] ストアが大きい場合に Slices パターンで分割されているか
- [ ] ミドルウェアの順序が `devtools` を最外側にしているか
- [ ] `persist` で `partialize` により関数を除いた状態のみ永続化しているか
