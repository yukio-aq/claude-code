# Curated Patterns

instincts/ で確認済みのベストプラクティス。
エージェントが実装・レビュー時に自動参照する。

---

<!--
## パターン追加テンプレート

### パターン名

**概要:** 何をするパターンか（1〜2文）

**適用条件:** いつ・どの状況で使うか

**良い例:**
```typescript
// コード例
```

**アンチパターン:**
```typescript
// やってはいけない例
```

**適用すべきでないケース:** 過剰適用を防ぐための注意点

---
-->

## `import type` を型のみのインポートに徹底する

**概要:** `verbatimModuleSyntax: true` 環境では、型のみのインポートに `import type` を使わないとバンドル時にエラーになる。

**適用条件:** TypeScript プロジェクト全般（特に `verbatimModuleSyntax: true` が設定されている場合は必須）。

**良い例:**
```typescript
// 型のみ → import type
import type { User } from './types'
import type { FC } from 'react'

// 値も含む → 通常の import
import { useState } from 'react'
import { userService } from './services/user'
```

**アンチパターン:**
```typescript
// NG: 型のみなのに通常 import
import { User } from './types'
```

**適用すべきでないケース:** なし。型か値かを意識して常に使い分ける。

---

## `try/finally` で非同期処理のローディング state をリセットする

**概要:** API 呼び出しのローディングフラグは `finally` でリセットしないと、エラー時に固着するバグが発生する。

**適用条件:** `isLoading` / `isFetching` などの state を持つすべての非同期処理。

**良い例:**
```typescript
const handleFetch = async () => {
  setLoading(true)
  try {
    const data = await api.fetchData()
    setData(data)
  } catch (err) {
    setError(err)
  } finally {
    setLoading(false) // 成功・失敗どちらでも必ず実行
  }
}
```

**アンチパターン:**
```typescript
// NG: catch の中だけでリセット → 正常終了時にも固着する可能性がある
const handleFetch = async () => {
  setLoading(true)
  try {
    const data = await api.fetchData()
    setData(data)
    setLoading(false) // 例外が飛んだら実行されない
  } catch (err) {
    setError(err)
    setLoading(false)
  }
}
```

**適用すべきでないケース:** なし。非同期処理のローディング管理は常に `finally` を使う。

---

## Zod スキーマは `schemas/` に集約する

**概要:** バリデーションスキーマを route ハンドラ内にインラインで書かず、`schemas/` または `packages/shared/schemas/` に分離する。

**適用条件:** Zod を使うすべての TypeScript プロジェクト。モノレポの場合は `packages/shared/schemas/` に置いてフロント・バックで共有する。

**良い例:**
```typescript
// packages/shared/src/schemas/user.schema.ts
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
})
export type CreateUserInput = z.infer<typeof CreateUserSchema>

// routes/user.ts
import { CreateUserSchema } from '@shared/schemas/user.schema'
app.post('/users', zValidator('json', CreateUserSchema), async (c) => { ... })
```

**アンチパターン:**
```typescript
// NG: route 内にインラインで定義
app.post('/users', zValidator('json', z.object({
  email: z.string().email(),
  name: z.string().min(1),
})), async (c) => { ... })
```

**適用すべきでないケース:** スクリプトや使い捨てツールなど、再利用が不要な場合はインラインで書いてよい。

---

## React の `key` はリストの性質に合わせて選ぶ

**概要:** `key` の選び方を誤るとコンポーネントの同一性が崩れて再レンダリングバグが発生する。リストの性質ごとに使い分ける。

**適用条件:** React のリストレンダリング全般。

**良い例:**
```typescript
// 表示専用リスト（並べ替えなし）→ コンテンツ文字列
items.map((item) => <Tag key={item} label={item} />)

// File リスト → name + lastModified の組み合わせ（同名ファイルの重複対策）
files.map((f) => <FileItem key={`${f.name}-${f.lastModified}`} file={f} />)

// 固定長・並べ替えなしの入力フォーム配列 → index で安定化
workItems.map((item, i) => <WorkItemInput key={`work-item-${i}`} item={item} />)

// ID がある動的リスト → ID を使う（最優先）
users.map((u) => <UserRow key={u.id} user={u} />)
```

**アンチパターン:**
```typescript
// NG: 並べ替え・フィルタが発生するリストで index を使う
users.map((u, i) => <UserRow key={i} user={u} />) // 並べ替え時にバグ
```

**適用すべきでないケース:** 固定長で順序も変わらない入力フォーム配列は index が適切。

---

## エージェント委譲は「作業範囲が大きく明確」なときに限る

**概要:** サブエージェントへの委譲はコンテキスト往復コストが発生するため、小さなタスクでは逆効率になる。

**適用条件:** `chief-of-staff` / `refactor-planner` など複数エージェントを扱う場面。

**良い例:**
```
委譲すべきケース:
- 複数ファイル・複数レイヤーにまたがる実装（backend + frontend + test）
- 大量のファイル読み込みが必要な調査（Explore への委譲）
- 独立して並列実行できる作業

委譲しないケース:
- 単一ファイルの修正
- 5分以内で終わる小さな変更
- コンテキストをそのまま引き継ぐ必要がある作業
```

**アンチパターン:** 単純な1ファイル修正を `chief-of-staff` 経由で複数エージェントに分解する（オーバーエンジニアリング）。

**適用すべきでないケース:** 単独領域の単純タスクは直接 `*-implementer` を呼ぶ。

---
