---
last_updated: 2026-05-09
confidence: high
review_after: 2026-11-09
---

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

### 外部 HTTP サーバーの統合テストは `http.createServer(port: 0)` でモックサーバーを立てる

**概要:** `vi.mock` で HTTP クライアントをモックせず、OS が割り当てるランダムポート（port 0）に実際の HTTP サーバーを立てて統合テストする。シリアライズ/デシリアライズを含む実際のリクエストパスを通せる。

**適用条件:** 外部 HTTP エンドポイントを呼び出すクライアント（auth-service・payment-gateway 等）の統合テスト。

**良い例:**
```typescript
import { createServer, type Server } from 'http'

let server: Server
let baseUrl: string

beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/tokens/exchange' && req.method === 'POST') {
      res.writeHead(200)
      res.end(JSON.stringify({ access_token: 'mock-token' }))
    } else {
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'not_found' }))
    }
  })

  await new Promise<void>((resolve) => {
    server.listen(0, () => { // port 0 = OS が空きポートを自動割り当て
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        baseUrl = `http://localhost:${addr.port}`
      }
      resolve()
    })
  })
})

afterAll(() => { server.close() })

it('should exchange token', async () => {
  const client = new AuthServiceClient(baseUrl)
  const token = await client.exchangeToken('user-token')
  expect(token).toBe('mock-token')
})
```

**アンチパターン:**
```typescript
// NG: fetch をモックすると実際のシリアライズ/ヘッダー処理を通らない
vi.mock('node-fetch', () => ({
  default: vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ access_token: 'mock-token' }),
  }),
}))
```

**適用すべきでないケース:** ユニットテストでビジネスロジックだけ検証したい場合はモックで十分。モックサーバーのルーティングは最低限に保ち、本物の API サーバーを再実装しない。

---

### `vi.hoisted()` で `vi.mock` ファクトリに変数を渡す

**概要:** `vi.mock()` ファクトリ内からファクトリ外の変数を参照するとホイスティングの順序で `undefined` になる。`vi.hoisted()` で事前に生成したオブジェクトをファクトリ内で参照することで解決する。

**適用条件:** Vitest で `vi.mock()` ファクトリ内からモック関数（`vi.fn()`）を外部で制御したいとき。

**良い例:**
```typescript
// 1. vi.hoisted で事前生成
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}))

// 2. vi.mock ファクトリ内で参照（hoist 済みなので undefined にならない）
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
}))

// 3. テスト内で制御
mockSend.mockResolvedValue({ MessageId: 'test-id' })
```

**アンチパターン:**
```typescript
// NG: ファクトリ外の変数をファクトリ内で参照 → hoist 順序で undefined になる
const mockSend = vi.fn()
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn().mockImplementation(() => ({ send: mockSend })), // undefined
}))
```

**適用すべきでないケース:** モック関数を外部から制御する必要がなく、ファクトリ内でインライン定義できる場合は `vi.hoisted()` は不要。

---

### モジュールレベル定数は純粋関数として切り出してユニットテストする

**概要:** `const X = Number(process.env.FOO)` のようにモジュールロード時に評価される定数は、env を変えても再 import しないと変わらないためテストしにくい。パース関数として切り出してエクスポートし、そちらをユニットテストする。

**適用条件:** 環境変数から計算される定数をテストしたいとき。

**良い例:**
```typescript
// OK: 純粋なパース関数として切り出してエクスポート
export const parseTimeoutMs = (value: string | undefined): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000
}

export const TIMEOUT_MS = parseTimeoutMs(process.env.TIMEOUT_MS)

// テスト
import { parseTimeoutMs } from './config'
it('should use default when env is missing', () => {
  expect(parseTimeoutMs(undefined)).toBe(5000)
})
it('should parse valid number', () => {
  expect(parseTimeoutMs('3000')).toBe(3000)
})
```

**アンチパターン:**
```typescript
// NG: env を操作して再 import しても、モジュールは評価済みなので変わらない
process.env.TIMEOUT_MS = '3000'
const { TIMEOUT_MS } = await import('./config')
expect(TIMEOUT_MS).toBe(3000) // 失敗する
```

**適用すべきでないケース:** 定数のテストが不要な場合はモジュールレベルで直接定義してよい。

---

### API エンドポイントのテストにバリデーション異常系（422）を含める

**概要:** 新しいエンドポイントのテストには正常系だけでなく、必須フィールド欠落・不正値による 422 Unprocessable Entity ケースを必ず追加する。バリデーション制約の動作を検証しないとリグレッションに気づけない。

**適用条件:** Pydantic・Zod・class-validator 等でリクエストバリデーションを行う API エンドポイントのテストを書くとき。

**良い例:**
```python
# 正常系
def test_create_record_success(client):
    res = client.post("/records", json={"work_date": "2026-06-16", "status": "active"})
    assert res.status_code == 200

# バリデーション異常系: フィールド不正値
def test_create_record_invalid_status(client):
    res = client.post("/records", json={"work_date": "2026-06-16", "status": "INVALID"})
    assert res.status_code == 422

# バリデーション異常系: 必須フィールド欠落
def test_create_record_missing_required(client):
    res = client.post("/records", json={"status": "active"})  # work_date なし
    assert res.status_code == 422
```

**アンチパターン:**
```python
# NG: 正常系のみ → バリデーション制約を削除しても気づかない
def test_create_record(client):
    res = client.post("/records", json={"work_date": "2026-06-16", "status": "active"})
    assert res.status_code == 200
```

**適用すべきでないケース:** バリデーションロジックが存在しないエンドポイント（ID を受け取って DB 削除するだけ等）。

---

### sys.modules スタブでヘビー依存ライブラリをインポート前にモックする

**概要:** LlamaIndex・psycopg など起動コストが高い依存ライブラリは、`sys.modules` に `types.ModuleType` のスタブを差し込むことで、実ライブラリをインストールせずにテストできる。

**適用条件:** CI 環境やユニットテストで、ヘビーな依存（ML ライブラリ・DB ドライバ等）をインストールせずにモジュールをインポート・テストしたいとき。

**良い例:**
```python
# conftest.py または各テストファイルのトップレベルで実行する
import sys
import types

def _stub_module(name: str) -> types.ModuleType:
    mod = types.ModuleType(name)
    sys.modules.setdefault(name, mod)
    return mod

# スタブ差し込み（import よりも前に実行する）
_stub_module("llama_index")
_stub_module("llama_index.core")
_stub_module("psycopg")

# 各テストでシングルトンをリセットする
import pytest

@pytest.fixture(autouse=True)
def reset_singleton():
    sys.modules.pop("app.services.rag.setup", None)  # キャッシュ済みモジュールを破棄
    yield
```

**アンチパターン:**
```python
# NG: ヘビーな依存を実際にインポートしてしまう → CI が遅い・インストール必須
from llama_index.core import VectorStoreIndex  # LlamaIndex が未インストールなら ImportError

# NG: unittest.mock.patch だけでは import 時点のエラーを防げない
with patch("llama_index.core.VectorStoreIndex"):  # import 自体は走ってしまう
    ...
```

**適用すべきでないケース:** 実際の DB・ベクターストアと組み合わせた統合テストではスタブを使わず実依存を使う。ユニットテストのみに適用する。

---

### Pydantic @computed_field のテストは依存元フィールドを経由する

**概要:** Pydantic の `@computed_field` プロパティは setter がないため `mocker.patch.object()` で直接モックできない。依存元のフィールド（`@computed_field` が参照するフィールド）をモックして間接的に制御する。

**適用条件:** pytest-mock で Pydantic モデルの `@computed_field` の計算結果をテストで制御したいとき。

**良い例:**
```python
# settings.py
from pydantic_settings import BaseSettings
from pydantic import computed_field

class Settings(BaseSettings):
    database_url: str = "postgresql://localhost/mydb"

    @computed_field
    @property
    def async_database_url(self) -> str:
        return self.database_url.replace("postgresql://", "postgresql+psycopg_async://")

# テスト: 依存元 (database_url) をモックして computed_field の結果を間接制御
def test_async_url(mocker):
    mocker.patch.object(
        Settings,
        "database_url",
        new_callable=mocker.PropertyMock,
        return_value="postgresql://testhost/testdb",
    )
    settings = Settings()
    assert settings.async_database_url == "postgresql+psycopg_async://testhost/testdb"
```

**アンチパターン:**
```python
# NG: @computed_field は setter がないため直接モックできない → TypeError
mocker.patch.object(Settings, "async_database_url", return_value="mock://url")
# TypeError: cannot set 'async_database_url' attribute of immutable type 'Settings'
```

**適用すべきでないケース:** `@computed_field` が外部 API を呼ぶなど依存元フィールドだけでは制御できない場合は、その外部呼び出しをモックする。

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

### モジュールレベルの mutable dict をテスト間で共有する

**問題:** モジュールレベルで定義した `dict` をテストデータとして共有すると、あるテストが dict を直接変更した場合に後続テスト全体の入力データが汚染される。

**発生状況:** `TEST_PAYLOAD = {...}` のようなモジュールレベル定数をテスト間で共有するとき。

**悪い例:**
```python
# NG: モジュールレベルで共有 → テストが直接変更すると後続テストに影響
TEST_PAYLOAD = {"status": "pending", "amount": 100}

def test_approve():
    TEST_PAYLOAD["status"] = "approved"  # モジュールレベルの dict を直接変更
    res = client.post("/approve", json=TEST_PAYLOAD)
    assert res.status_code == 200

def test_reject():
    # TEST_PAYLOAD["status"] が "approved" に汚染されている
    res = client.post("/reject", json=TEST_PAYLOAD)  # 意図しない入力
    assert res.status_code == 200
```

**良い例:**
```python
# OK: テスト内でローカル定義する
def test_approve():
    payload = {"status": "pending", "amount": 100}
    payload["status"] = "approved"
    res = client.post("/approve", json=payload)
    assert res.status_code == 200

# OK: pytest.fixture で毎回新しいインスタンスを生成する
@pytest.fixture
def base_payload():
    return {"status": "pending", "amount": 100}

def test_reject(base_payload):
    base_payload["status"] = "rejected"
    res = client.post("/reject", json=base_payload)
    assert res.status_code == 200
```

**根拠:** Python の dict はミュータブルなため、テスト内で変更するとモジュールレベルの参照先が書き換わる。各テストは独立して実行できる必要がある。fixture かテスト関数ローカルで毎回新しい dict を生成する。

---
