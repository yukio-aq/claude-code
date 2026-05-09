# テスト — パターン & アンチパターン

Vitest を中心としたユニット・統合テストの設計パターン。
test-implementer / qa-engineer / frontend-reviewer / backend-reviewer が参照する。

---

## パターン

### タイマーベース非同期処理のテストは fake timers で完結させる

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

### 直列実行テストは "同時実行数カウンター" で並列漏れを検出する

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
      await delay(10)
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

### ランダム依存コードのテストは `vi.spyOn(Math, 'random')` で乱数を固定する

**概要:** 指数バックオフのジッターなど `Math.random()` に依存する処理をテストするとき、スパイで乱数を固定することで遅延の精度を決定論的に検証できる。

**適用条件:** Vitest で `Math.random()` を内部で使う処理（ジッター付きバックオフ・ランダムサンプリング等）の遅延や値をアサートするとき。

**良い例:**
```typescript
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0) // ジッターをゼロに固定
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks() // スパイが次テストに漏れるのを防ぐ
})

it('should retry with exponential backoff: 1s → 2s', async () => {
  const rejection = expect(operation()).rejects.toThrow('max retries')

  await vi.advanceTimersByTimeAsync(1000) // 1回目リトライ（1秒後）
  expect(mockFn).toHaveBeenCalledTimes(2)

  await vi.advanceTimersByTimeAsync(2000) // 2回目リトライ（2秒後）
  expect(mockFn).toHaveBeenCalledTimes(3)

  await vi.runAllTimersAsync()
  await rejection
})
```

**アンチパターン:**
```typescript
// NG: runAllTimersAsync は全タイマーを即時消化 → 遅延の精度・順序を検証できない
await vi.runAllTimersAsync()
expect(mockFn).toHaveBeenCalledTimes(4) // 何回目のリトライで何秒待ったか不明
```

**適用すべきでないケース:** 遅延の順序・精度を検証する必要がなく「最終的に成功/失敗する」だけを確認したい場合は `runAllTimersAsync()` で十分。

---

## アンチパターン

### ESM プロジェクトの `vi.mock` ファクトリ内で `require()` を使う

**問題:** `"type": "module"` の ESM プロジェクトでは `vi.mock` のファクトリ関数内で `require()` を呼ぶとエラーになる。`require` は CommonJS 専用であり ESM では未定義。

**発生状況:** CommonJS の vi.mock サンプルをそのまま ESM プロジェクトにコピーしたとき。

**悪い例:**
```typescript
// NG: ESM プロジェクトでは require は未定義
vi.mock('./db', () => {
  const { DrizzleClient } = require('./db') // ReferenceError: require is not defined
  return { db: vi.fn(() => new DrizzleClient()) }
})
```

**良い例:**
```typescript
// OK: async ファクトリ + 動的 import を使う
vi.mock('./db', async () => {
  const { DrizzleClient } = await import('./db')
  return { db: vi.fn(() => new DrizzleClient()) }
})

// OK: import なしで直接モックオブジェクトを返す（依存が不要な場合はこちらが簡潔）
vi.mock('./db', () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}))
```

**根拠:** ESM では `require` が存在しないため実行時エラーになる。`vi.mock` のファクトリは巻き上げ（hoist）されるため通常の `import` も使えず、動的 `import()` が唯一の手段。

---

### `expect(promise).rejects` ハンドラをタイマー実行後にアタッチする

**問題:** `vi.runAllTimersAsync()` でタイマーを先に消化すると、reject ハンドラがない状態で Promise が reject され unhandled rejection になる。テストが意図せずパスしたりエラーになったりする。

**発生状況:** `vi.useFakeTimers()` を使ったテストで、タイマー実行によって Promise が reject されるケース（タイムアウト・バックオフ上限超過など）を検証するとき。

**悪い例:**
```typescript
// NG: タイマーを先に消化 → reject 時点でハンドラが存在せず unhandled rejection
await vi.runAllTimersAsync()
await expect(promise).rejects.toThrow('timeout') // 手遅れ
```

**良い例:**
```typescript
// OK: ハンドラを先にアタッチしてからタイマーを消化
const rejection = expect(promise).rejects.toThrow('timeout')
await vi.runAllTimersAsync()
await rejection
```

**根拠:** Promise の reject ハンドラは reject が発生する前にアタッチしておく必要がある。`runAllTimersAsync()` がタイマーを即時消化する性質上、呼び出し前にハンドラを設定しないと unhandled rejection として扱われる。

---
