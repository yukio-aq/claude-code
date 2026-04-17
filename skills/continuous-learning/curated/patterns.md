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

## ファイル input の同一ファイル再選択バグを `input.value = ''` で解消する

**概要:** 同じファイルを連続して選択すると `onChange` イベントが発火しない。選択後に `input.value = ''` でリセットすることで毎回発火させられる。

**適用条件:** `<input type="file">` を使うすべてのファイルアップロードコンポーネント。

**良い例:**
```typescript
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (file) onFileSelect(file)
  e.target.value = '' // 同一ファイルの再選択を可能にする
}
```

**アンチパターン:**
```typescript
// NG: リセットなし → 同じファイルを選ぶと onChange が発火しない
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (file) onFileSelect(file)
}
```

**適用すべきでないケース:** なし。ファイル input では常にリセットする。

---

## "その他" 入力を持つ Select は選択意図と値を独立した state で管理する

**概要:** 「その他」を選んだかどうかを value（空文字）で判定すると、未選択との区別がつかずバグになる。選択意図を独立した boolean state で持つ。

**適用条件:** 「その他」→ フリーテキスト入力に切り替わる Select コンポーネント全般。

**良い例:**
```typescript
const [otherSelected, setOtherSelected] = useState(false)
const [value, setValue] = useState('')

const handleChange = (v: string) => {
  if (v === '__other__') {
    setOtherSelected(true)
    setValue('')
  } else {
    setOtherSelected(false)
    setValue(v)
  }
}

// 表示切り替えは otherSelected で判定（value の空文字に依存しない）
return otherSelected ? <TextInput value={value} onChange={setValue} /> : <Select onChange={handleChange} />
```

**アンチパターン:**
```typescript
// NG: value === '' で「その他」を判定 → 未選択と区別できない
{value === '' && <TextInput ... />}
```

**適用すべきでないケース:** 選択肢が固定で「その他」がないシンプルな Select。

---

## Remember me は localStorage、セッション限定は sessionStorage を使い分ける

**概要:** 「ログイン状態を保持」チェックの有無で保存先を変える。起動時チェックは両方を参照する。

**適用条件:** ログイン画面に「ログイン状態を保持する」オプションがある認証実装。

**良い例:**
```typescript
const login = (token: string, rememberMe: boolean) => {
  const storage = rememberMe ? localStorage : sessionStorage
  storage.setItem('authToken', token)
}

// 起動時: どちらに保存されていても復元できるようにする
const restoreToken = () =>
  localStorage.getItem('authToken') ?? sessionStorage.getItem('authToken')
```

**アンチパターン:**
```typescript
// NG: 常に localStorage → ブラウザを閉じても残り続ける
localStorage.setItem('authToken', token)
```

**適用すべきでないケース:** 管理画面など「セッション限定のみ」が要件の場合は sessionStorage 固定でよい。

---

## `JSON.parse` はストレージから読むとき必ず `try/catch` でガードする

**概要:** ストレージの値が破損・改ざんされていると `JSON.parse` がクラッシュしてアプリが起動不能になる。エラー時はストレージをクリアして初期状態に戻す。

**適用条件:** `localStorage` / `sessionStorage` から JSON を読み出す箇所すべて。

**良い例:**
```typescript
const loadState = () => {
  try {
    const raw = sessionStorage.getItem('appState')
    return raw ? JSON.parse(raw) : null
  } catch {
    sessionStorage.removeItem('appState') // 破損していたらクリア
    return null
  }
}
```

**アンチパターン:**
```typescript
// NG: try/catch なし → 破損データで起動時クラッシュ
const state = JSON.parse(sessionStorage.getItem('appState')!)
```

**適用すべきでないケース:** なし。ストレージからの JSON 読み出しは常にガードする。

---

## 印刷ページサイズは `window.print()` 前の `<style>` 動的注入で制御する

**概要:** CSS の `@page` ルールはブラウザ・OS の印刷設定に上書きされることがある。`window.print()` 直前に `<style>` タグを動的に挿入することで確実にページサイズを制御できる。

**適用条件:** A3・A4 など特定サイズ・向きでの印刷が必須な帳票・レポート画面。

**良い例:**
```typescript
const handlePrint = () => {
  const style = document.createElement('style')
  style.textContent = '@page { size: A3 landscape; margin: 10mm; }'
  document.head.appendChild(style)
  window.print()
  document.head.removeChild(style) // 印刷後にクリーンアップ
}
```

**アンチパターン:**
```typescript
// NG: CSS ファイルの @page だけに頼る → ブラウザ設定に負けることがある
/* print.css */
@page { size: A3 landscape; }
```

**適用すべきでないケース:** 印刷サイズがユーザー任意でよい場合（標準ブラウザ印刷ダイアログで足りる）。

---

## Python バックエンドの ORM は SQLModel（Pydantic + SQLAlchemy 統合）を使う

**概要:** Prisma は JavaScript/TypeScript 向けに成熟しており、Python サポートは限定的。Python バックエンドでは SQLModel（Pydantic の型安全性 + SQLAlchemy の実績）が適切。

**適用条件:** Python（FastAPI / Starlette）バックエンドで ORM を選定するとき。

**良い例:**
```python
from sqlmodel import SQLModel, Field, Session, create_engine

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str
    name: str

# Pydantic モデルと DB モデルを兼ねるため、スキーマ定義が1箇所に集約される
```

**アンチパターン:**
```python
# NG: Python プロジェクトで Prisma を採用 → Python クライアントが未成熟でエコシステムが薄い
# prisma generate 後の型補完・マイグレーション体験が TypeScript より劣る
```

**適用すべきでないケース:** Node.js バックエンドなら Prisma / Drizzle を使う。SQLModel は Python 専用。

---

## マルチステップフォームのバリデーションはボタン契機で一括チェックしサマリー表示する

**概要:** ステップ送信ボタン押下時に `validateStepN()` で一括チェックし、エラーがあればサマリーバナーをステップ内に表示してステップを戻す。per-field リアルタイムバリデーションより実装がシンプルで UX も一貫する。

**適用条件:** 複数ステップで構成される入力フォーム（ウィザード UI）。

**良い例:**
```typescript
const validateStep0 = (): string[] => {
  const errors: string[] = []
  if (!formData.name) errors.push('名前を入力してください')
  if (!formData.date) errors.push('日付を入力してください')
  return errors
}

const handleNextStep = () => {
  const errors = validateStep0()
  if (errors.length > 0) {
    setValidationErrors(errors) // サマリーバナーに表示
    return
  }
  setStep(1)
}
```

**アンチパターン:**
```typescript
// NG: フィールドごとにリアルタイムでバリデーション → ステップをまたぐ状態管理が複雑になる
const handleNameChange = (v: string) => {
  setName(v)
  setNameError(v ? '' : '名前を入力してください')
}
```

**適用すべきでないケース:** 単一ページフォームでリアルタイムフィードバックが UX 要件の場合。

---

## タイマーベース非同期処理のテストは fake timers で完結させる

**概要:** `setTimeout` / `setInterval` を内部で使うクラス（キュー・レートリミッター・リトライ等）のテストは `vi.useFakeTimers()` + `await vi.runAllTimersAsync()` で実時間待ちなしに完結できる。

**適用条件:** Vitest で遅延・backoff・ポーリングを持つ非同期処理をテストするとき。

**良い例:**
```typescript
describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers() // 忘れると後続テストに影響
  })

  it('should process queue after delay', async () => {
    const limiter = new RateLimiter({ intervalMs: 1000 })
    const promise = limiter.enqueue(() => fetchData())

    await vi.runAllTimersAsync() // 実時間を待たずにタイマーを全消化

    await expect(promise).resolves.toBeDefined()
  })
})
```

**アンチパターン:**
```typescript
// NG: 実時間で待つ → テストが遅くなりフラッキーになる
it('should process after 1 second', async () => {
  const limiter = new RateLimiter({ intervalMs: 1000 })
  const promise = limiter.enqueue(() => fetchData())
  await new Promise((r) => setTimeout(r, 1100)) // 実時間1秒以上待機
  await expect(promise).resolves.toBeDefined()
})
```

**適用すべきでないケース:** 外部APIのタイムアウトなど「実時間の経過そのものをテストしたい」場合は Integration テストで実時間を使う。

---

## 直列実行テストは "同時実行数カウンター" で並列漏れを検出する

**概要:** キューやワーカーが「1件ずつしか処理しない」ことを検証する際、同時実行数カウンターを仕込んで最大値が1であることをアサートする。

**適用条件:** 直列実行・排他制御・ミューテックス相当の動作をテストするとき。

**良い例:**
```typescript
it('should process tasks sequentially', async () => {
  let concurrent = 0
  let maxConcurrent = 0

  const tasks = Array.from({ length: 5 }, (_, i) =>
    queue.add(async () => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await delay(10) // 実際の処理をシミュレート
      concurrent--
      return i
    })
  )

  await Promise.all(tasks)

  expect(maxConcurrent).toBe(1) // 同時実行が常に1件だったことを保証
})
```

**アンチパターン:**
```typescript
// NG: 完了順序だけ見ても並列実行されていないことは証明できない
const results = await Promise.all(tasks)
expect(results).toEqual([0, 1, 2, 3, 4]) // 順序が正しくても並列実行されている可能性がある
```

**適用すべきでないケース:** 並列実行数の上限が2以上（concurrency limit）の場合は `expect(maxConcurrent).toBeLessThanOrEqual(N)` に変える。

---
