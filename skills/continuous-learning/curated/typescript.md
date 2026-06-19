---
last_updated: 2026-05-09
confidence: high
review_after: 2026-11-09
---

# TypeScript / JavaScript — パターン & アンチパターン

TypeScript・JavaScript の型設計・非同期処理・ブラウザ API に関する汎用パターン。
frontend-implementer / backend-implementer / frontend-reviewer / backend-reviewer が参照する。

---

## パターン

### `import type` を型のみのインポートに徹底する

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

### `try/finally` で非同期処理のローディング state をリセットする

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
// NG: try の中だけでリセット → 例外が飛んだら実行されない
const handleFetch = async () => {
  setLoading(true)
  try {
    const data = await api.fetchData()
    setData(data)
    setLoading(false)
  } catch (err) {
    setError(err)
    setLoading(false)
  }
}
```

**適用すべきでないケース:** なし。非同期処理のローディング管理は常に `finally` を使う。

---

### `JSON.parse` はストレージから読むとき必ず `try/catch` でガードする

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

## アンチパターン

### ローディング state のリセットを `catch` 節だけで行う

**問題:** `catch` の中だけで `setLoading(false)` すると、正常終了パスで例外が飛んだ場合にローディングが固着する。

**発生状況:** API 呼び出しや非同期処理でローディング UI を管理するとき。

**悪い例:**
```typescript
// NG
const fetch = async () => {
  setLoading(true)
  try {
    const res = await api.get()
    setData(res)
    setLoading(false) // ここで例外が飛ぶと以降が実行されない
  } catch (e) {
    setError(e)
    setLoading(false)
  }
}
```

**良い例:**
```typescript
// OK
const fetch = async () => {
  setLoading(true)
  try {
    const res = await api.get()
    setData(res)
  } catch (e) {
    setError(e)
  } finally {
    setLoading(false)
  }
}
```

**根拠:** 複数プロジェクトで「ローディング固着バグ」として観測。`finally` を使う習慣で完全に防止できる。

---

### ジェネリクス API ラッパーの型引数を呼び出し側に任せる

**問題:** `apiFetch<T>()` のようなラッパーを作っても、呼び出し側が型引数を渡さないと全呼び出しが `Promise<unknown>` になり型安全性が失われる。

**発生状況:** API 通信の共通ラッパーを定義した後、各呼び出し箇所で `<ResponseType>` の指定を忘れたとき。

**悪い例:**
```typescript
// NG: 型引数なし → Promise<unknown> に推論される
const users = await apiFetch('/users') // Promise<unknown>
const data = users.map(u => u.name)    // 型エラーにならず実行時にクラッシュ
```

**良い例:**
```typescript
// OK: ラッパー定義側で型を確定させる薄い関数を用意する
export const fetchUsers = () => apiFetch<User[]>('/users') // Promise<User[]>

// または呼び出し側で必ず明示する
const users = await apiFetch<User[]>('/users')
```

**根拠:** TypeScript のジェネリクスは型引数が省略されると `unknown` に推論される。呼び出し側の注意に頼るより、型引数付きの薄いラッパー関数を用意して型を確定させる設計のほうが安全。

---

### `URLSearchParams` に `undefined` を含むオブジェクトを渡す

**問題:** `new URLSearchParams(params)` に `undefined` 値が含まれると、クエリ文字列に `key=undefined` が混入する。

**発生状況:** オプションクエリパラメータを持つ API 呼び出しで、条件によっては値が `undefined` になる場合。

**悪い例:**
```typescript
// NG: page が undefined のとき ?page=undefined がクエリに混入する
const params = { limit: '10', page: undefined }
const url = `/api/items?${new URLSearchParams(params as Record<string, string>)}`
// → /api/items?limit=10&page=undefined
```

**良い例:**
```typescript
// OK: undefined を事前に除外する
const params = { limit: '10', page: undefined }
const filtered = Object.fromEntries(
  Object.entries(params).filter(([, v]) => v !== undefined)
) as Record<string, string>
const url = `/api/items?${new URLSearchParams(filtered)}`
// → /api/items?limit=10
```

**根拠:** `URLSearchParams` は `undefined` を文字列 `"undefined"` として扱う仕様。サーバー側でのパース失敗や意図しない絞り込み条件の混入につながる。

---

### `res.ok` を確認せずに `res.json()` を呼ぶ

**問題:** HTTP エラー時にサーバーが HTML を返すと、`res.json()` で "Unexpected token '<'" という不可解なエラーになる。

**発生状況:** `fetch` の結果をそのまま `res.json()` に渡す簡易実装。

**悪い例:**
```typescript
// NG: 500 エラーで HTML が返ったとき JSON パースエラーになる
const res = await fetch('/api/items')
const data = await res.json() // "Unexpected token '<', "<!DOCTYPE"... is not valid JSON"
```

**良い例:**
```typescript
// OK: res.ok で HTTP エラーを先に処理する
const res = await fetch('/api/items')
if (!res.ok) {
  throw new Error(`HTTP ${res.status}: ${res.statusText}`)
}
const data = await res.json()
```

**根拠:** `fetch` は HTTP エラー（4xx・5xx）でも Promise を reject しない。`res.ok` チェックを省略すると、エラーレスポンスが HTML の場合に JSON パースエラーとして誤報され根本原因の特定が困難になる。

---

### エラー時にモックデータへサイレントフォールバックする

**問題:** `catch` 節でモックデータに差し替えると、バックエンドが壊れているのに UI が正常動作しているように見える。デバッグ不能になり、特にデモ・本番環境で重大な混乱を招く。

**発生状況:** API 呼び出しが失敗したとき「とりあえず画面を動かす」目的でモックに切り替えるとき。

**悪い例:**
```typescript
// NG: エラーをモックで隠す → 障害に気づけない
try {
  const data = await api.fetchItems()
  setItems(data)
} catch {
  setItems(MOCK_ITEMS)  // サイレントフォールバック
}
```

**良い例:**
```typescript
// OK: エラーを明示して UI に伝える
try {
  const data = await api.fetchItems()
  setItems(data)
} catch (e) {
  setError(e)  // エラー状態を UI で表示
}
```

**根拠:** フォールバックはエラーを隠蔽する。モックに切り替わった瞬間から「動いているように見えるが実際は壊れている」状態になり、根本原因の発見が著しく遅れる。開発中だけモックを使いたい場合は環境変数フラグで明示的に切り替える。

---

### TypeScript 型アサーションは外部 API レスポンスの実行時 null ガードにならない

**問題:** `const data: T = await res.json()` の型注釈は TypeScript のコンパイル時のみ有効で、実行時に外部 API が `null` / `undefined` を返した場合を防げない。

**発生状況:** fetch の結果に型注釈か `as` アサーションを付けてそのまま使うとき。

**悪い例:**
```ts
// NG: TypeScript は通るが、data.services が null のとき TypeError
const data: { services: ConnectionInfo[] } = await res.json();
return data.services.filter((s) => s.name.startsWith("salesforce"));
```

**良い例:**
```ts
// OK: ?? [] でフォールバックして実行時も安全にする
const data: { services?: ConnectionInfo[] } = await res.json();
return (data.services ?? []).filter((s) => s.name.startsWith("salesforce"));
```

**根拠:** 外部 API のレスポンスは型が保証されない。`res.json()` の結果に型注釈や `as` を付けても、実行時に `null` / `undefined` が来れば TypeError になる。コレクション型フィールドは `?? []`、単一値は `?? defaultValue` でフォールバックする。

---

### 外部 API の `string | undefined` 型をガードなしでキーに使う

**問題:** `event.id` などの外部 API 型が `string | undefined` の場合、そのままキーや識別子に使うと `"calendar-undefined"` のような文字列で衝突する。

**発生状況:** googleapis や外部 SDK のイベント/レコードの ID をマップのキーや複合キーに使うとき。

**悪い例:**
```ts
// NG: event.id が undefined のとき "calendar-undefined" になる
const key = `calendar-${event.id}`
map.set(key, event)
```

**良い例:**
```ts
// OK: undefined を事前にガードしてスキップする
if (!event.id) continue;
const key = `calendar-${event.id}`
map.set(key, event)
```

**根拠:** TypeScript のテンプレートリテラルは `undefined` を `"undefined"` 文字列として暗黙変換する。型エラーにならないままキーが衝突するため、キーへの利用前に明示的なガードが必要。

---

### URL パラメータの数値変換後に NaN 検証を省く

**問題:** `searchParams.get()` の戻り値は文字列なので `Number()` で変換すると、未指定・非数値文字列のとき `NaN` になる。NaN のまま計算に使うと全ての算術が NaN に伝播する。

**発生状況:** URL クエリパラメータ（`?page=2` 等）を数値として扱うとき。

**悪い例:**
```typescript
// NG: "abc" や null のとき NaN になり、計算が壊れる
const page = Number(searchParams.get('page'))
const offset = page * 10  // NaN * 10 = NaN
```

**良い例:**
```typescript
// OK: Number.isNaN() で検証してデフォルト値にフォールバック
const rawPage = searchParams.get('page')
const page = rawPage !== null && !Number.isNaN(Number(rawPage))
  ? Number(rawPage)
  : 1
const offset = page * 10
```

**根拠:** URL パラメータは任意の文字列が来る。`Number()` は非数値に対して `NaN` を返し、NaN を含む算術演算は全て NaN に伝播する。`Number.isNaN()` でバリデーションしてからデフォルト値にフォールバックする。

---

### API リクエストボディのフィールドを手書き列挙して型定義と二重管理する

**問題:** リクエストボディを `{ fieldA: payload.fieldA, fieldB: payload.fieldB }` のように手書きで列挙すると、フィールド追加時に型定義とボディの両方を修正しないといけない。漏れが発生しやすい。

**発生状況:** TypeScript の API 関数でペイロードオブジェクトをリクエストボディに変換するとき。

**悪い例:**
```typescript
// NG: 型定義とボディの二重管理 → フィールド追加時に漏れが発生する
async function updateRecord(payload: UpdateRecordPayload) {
  return apiFetch('/records', {
    method: 'POST',
    body: JSON.stringify({
      route: payload.route,
      comment: payload.comment,
      attachmentFileIds: payload.attachmentFileIds,
      // 新フィールドを追加し忘れる可能性
    }),
  })
}
```

**良い例:**
```typescript
// OK: 送らないフィールドだけ除外して残りを spread → フィールド追加時に自動で含まれる
async function updateRecord(payload: UpdateRecordPayload) {
  const { _internalField, ...bodyFields } = payload
  return apiFetch('/records', {
    method: 'POST',
    body: JSON.stringify(bodyFields),
  })
}
```

**根拠:** 手書き列挙はフィールド追加のたびに型定義とボディの2箇所を修正する必要がある。destructuring + rest spread を使うと除外フィールドのみを明示的に指定でき、新フィールドは自動的に含まれる。

---
