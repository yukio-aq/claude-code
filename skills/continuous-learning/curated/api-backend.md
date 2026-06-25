---
last_updated: 2026-05-09
confidence: high
review_after: 2026-11-09
---

# API / バックエンド — パターン & アンチパターン

API 設計・DB 操作・Python バックエンドに関するパターン。
backend-implementer / backend-reviewer / database-reviewer が参照する。

---

## パターン

### Zod スキーマは `schemas/` に集約する

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

### アクション系エンドポイントはリソース ID のみ受け取る

**概要:** 既存リソースへのアクション（verify・approve・cancel 等）は、リクエストボディでデータを再送させず、URL の ID だけを受け取ってサーバー側で DB から復元する。

**適用条件:** `POST /resources/:id/action` 形式で既存レコードに対して操作を行うとき。

**良い例:**
```typescript
// OK: ID だけ受け取り、サーバー側で必要なデータを DB から取得
app.post('/races/:predictionId/verify', async (c) => {
  const { predictionId } = c.req.param()
  const prediction = await db.query.predictions.findFirst({
    where: eq(predictions.id, predictionId)
  })
  return verify(prediction)
})
```

**アンチパターン:**
```typescript
// NG: 既に DB にあるデータをフロントから再送させる（冗長・不整合リスク）
app.post('/races/verify', async (c) => {
  const { predictionId, predictedOrder, raceId, ...rest } = await c.req.json()
  return verify({ predictionId, predictedOrder, raceId, ...rest })
})
```

**適用すべきでないケース:** 操作時点の入力（コメント・承認理由等）が必要な場合はボディに含める。「DB に既にある情報」の再送が不要ということ。

---

### PATCH エンドポイントのリクエストボディは Zod `.strict()` で検証する

**概要:** PATCH ボディを `z.object({...})` で検証すると、未知フィールドはデフォルトで strip（無視）される。`z.strict()` を付けることで typo によるフィールドのサイレント無視を防ぐ。

**適用条件:** PATCH / PUT エンドポイントで部分更新を受け付けるとき。

**良い例:**
```typescript
const PatchUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
}).strict() // 未知フィールドはエラー → typo を検出できる

app.patch('/users/:id', zValidator('json', PatchUserSchema), async (c) => {
  const body = c.req.valid('json')
  await updateUser(c.req.param('id'), body)
})
```

**アンチパターン:**
```typescript
// NG: .strict() なし → { naem: "Alice" } のような typo がサイレントに無視される
const PatchUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
})
```

**適用すべきでないケース:** フォワード互換性が必要で将来追加フィールドを許容したい場合（SDK や外部 webhook のペイロードを受け取る場合等）は strip のままでよい。

---

### DynamoDB 条件付き書き込みで TOCTOU 競合を防ぐ

**概要:** 「Read → Check → Write」の2ステップ操作は競合が発生する（TOCTOU）。DynamoDB の条件付き書き込みで1発で原子的に実行し、競合時に `ConditionalCheckFailedException` をキャッチする。

**適用条件:** 複数プロセスが同一アイテムに同時書き込みする可能性がある場合（ロック取得・在庫引き当て・先着処理等）。

**良い例 (ElectroDB):**
```typescript
// ElectroDB の .where() は文字列を返す。op.or() は存在しないのでテンプレートリテラルで OR を組む
await LockEntity.update({ pk, sk })
  .set({ lockedBy: userId, lockExpiresAt: expiresAt })
  .where(
    (attr, op) =>
      // notExists を先頭に入れないとマイグレーション前の旧レコード（属性未存在）でロックが取れない
      `attribute_not_exists(${attr.lockedBy}) OR ${op.eq(attr.lockedBy, '')} OR ${op.eq(attr.lockedBy, userId)} OR ${op.lt(attr.lockExpiresAt, nowIso)}`,
  )
  .go({ response: 'all_new' })
```

**アンチパターン:**
```typescript
// NG: Read → Check → Write の2ステップ → 複数プロセスが同時に「空き」を確認して両方書き込む
const current = await LockEntity.get({ pk, sk }).go()
if (!current.data?.lockedBy) {
  await LockEntity.update({ pk, sk }).set({ lockedBy: userId }).go() // 競合発生
}
```

**競合ハンドリング:**
```typescript
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'

try {
  await acquireLock()
} catch (err) {
  // .name と .code の両方をチェックする（SDK バージョンによって差異がある）
  if (
    err instanceof ConditionalCheckFailedException ||
    (err as { name?: string }).name === 'ConditionalCheckFailedException'
  ) {
    throw new LockConflictError()
  }
  throw err
}
```

**適用すべきでないケース:** 単一プロセスからしか書き込まれないアイテムは条件付き書き込み不要。

---

### Hono ミドルウェア間の値受け渡しは `ContextVariableMap` module augmentation で型安全にする

**概要:** Hono の `c.set/c.get` はデフォルトで型が `unknown` になる。`ContextVariableMap` を拡張することでミドルウェアからハンドラへの値受け渡しを型安全にできる。

**適用条件:** Hono で認証ミドルウェアがパースした claims・token・user などをハンドラ側で取り出すとき。

**良い例:**
```typescript
// 型定義ファイル（例: src/types/hono.d.ts）
declare module 'hono' {
  interface ContextVariableMap {
    claims: PlatformClaims
    rawToken: string
  }
}

// ミドルウェア
app.use('*', authMiddleware) // c.set('claims', parsed) / c.set('rawToken', token)

// ハンドラ — c.get の返り値が PlatformClaims 型になる
app.get('/me', (c) => {
  const claims = c.get('claims') // PlatformClaims（型安全）
  return c.json({ userId: claims.sub })
})
```

**アンチパターン:**
```typescript
// NG: 拡張なし → c.get の返り値が unknown → as キャストが必要になる
const claims = c.get('claims') as PlatformClaims // 型安全でない
```

**適用すべきでないケース:** ミドルウェア間で受け渡す値が1〜2個程度でリクエストスコープ外に出ないなら、関数の引数で明示的に渡すほうがシンプルな場合もある。

---

### リクエストスコープの JWT はクロージャで伝達し、グローバル変数に置かない

**概要:** Lambda など並列実行環境でグローバル変数にトークンを保存すると、別リクエストのトークンが混入するリスクがある。クロージャ（`() => c.get("rawToken")`）でリクエストスコープに閉じる。

**適用条件:** Lambda・Worker・マルチスレッド環境で、認証トークンをダウンストリームのサービス/ツールに渡すとき。

**良い例:**
```typescript
// ルートハンドラでクロージャを生成してサービスに渡す
app.all('/mcp', authMiddleware, async (c) => {
  const server = createMcpServer(
    authClient,
    () => c.get('rawToken'), // クロージャ — リクエストごとに評価される
  )
  await server.handle(c.req.raw)
})

// サービス側は関数型で受け取る
type GetToken = () => string
function createMcpServer(client: AuthClient, getToken: GetToken) { ... }
```

**アンチパターン:**
```typescript
// NG: モジュールレベルのグローバルに保存 → 並列リクエスト間で上書きされる
let currentToken: string

app.use('*', async (c, next) => {
  currentToken = c.get('rawToken') // 別リクエストが来たら上書きされる
  await next()
})
```

**適用すべきでないケース:** シングルスレッド・シングルリクエストの CLI ツール等では問題にならないが、習慣としてクロージャを使うほうが安全。

---

### カスタムエラーにセマンティック boolean getter を持たせる

**概要:** エラー分岐を `err.body.error === "not_connected"` のような文字列比較に散らさず、意味のある boolean getter（`isNotConnected`・`isExpired`）に集約する。呼び出し側のコードがクリーンになりリファクタ時の変更箇所が1箇所になる。

**適用条件:** 複数のエラーコードを持つ外部サービスのエラーをカスタムエラークラスでラップするとき。

**良い例:**
```typescript
export class TokenExchangeError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: { error: string; error_description: string; connect_url?: string },
  ) {
    super(body.error_description)
  }

  get isNotConnected() { return this.body.error === 'not_connected' }
  get isExpired() {
    return this.body.error === 'token_expired' || this.body.error === 'token_revoked'
  }
  get isForbidden() { return this.body.error === 'forbidden' }
}

// 呼び出し側
if (err instanceof TokenExchangeError && err.isNotConnected) {
  return c.json({ connect_url: err.body.connect_url }, 401)
}
```

**アンチパターン:**
```typescript
// NG: 各ハンドラで文字列比較を繰り返す → 変更時に全箇所修正が必要
if (err.body?.error === 'not_connected') { ... }
if (err.body?.error === 'token_expired' || err.body?.error === 'token_revoked') { ... }
```

**適用すべきでないケース:** エラーコードが1〜2種類で分岐が1箇所しかない場合は getter を作るほど複雑ではない。

---

### クライアント起因と外部 API 起因のエラーを HTTP ステータスで分離する

**概要:** ファイル形式不一致はクライアント起因（415）、AI/外部 API 障害はサーバー起因（503）と明確に分けることで、クライアントが再試行すべきか否かを判断できる。

**適用条件:** ファイルアップロードや外部 AI API 呼び出しを含むエンドポイントで、エラー原因が複数ある場合。

**良い例:**
```typescript
// サービス層: クライアント起因のエラーは専用例外クラスで分類
class UnsupportedMimeTypeError extends Error {}

async function processFile(file: File) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new UnsupportedMimeTypeError(file.type)
  }
  return await aiClient.process(file)
}

// ルート層: 例外の種類で HTTP ステータスを分岐
app.post('/upload', async (c) => {
  try {
    return c.json(await processFile(await c.req.parseBody()))
  } catch (e) {
    if (e instanceof UnsupportedMimeTypeError) {
      return c.json({ error: 'unsupported format' }, 415)  // クライアントが修正すべき
    }
    return c.json({ error: 'AI service unavailable' }, 503)  // 再試行で解決する可能性
  }
})
```

**アンチパターン:**
```typescript
// NG: 全エラーを 500 に統一 → クライアントが再試行すべきか判断できない
} catch (e) {
  return c.json({ error: 'failed' }, 500)
}
```

**適用すべきでないケース:** エラー原因が1種類のみで起因の区別が不要な単純なエンドポイント。

---

### CLI スクリプトの起動前に必要な環境変数を検証する

**概要:** 外部サービスの初期化（LLM クライアント・ストレージ等）を呼び出す前に、必要な環境変数が設定されているかチェックして `sys.exit(1)` で明示終了する。

**適用条件:** API キー・接続文字列など必須の環境変数を要求する CLI スクリプトや初期化処理。

**良い例:**
```python
# OK: 起動時に必要な env を全チェックして早期終了
import os, sys

def check_env():
    required = ["OPENAI_API_KEY", "DATABASE_URL", "S3_BUCKET"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        print(f"Error: missing required env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    check_env()  # 外部サービスの初期化より前に呼ぶ
    setup_llamaindex()  # ここで初めてクライアントを作る
    main()
```

**アンチパターン:**
```python
# NG: env チェックなし → 初期化中に KeyError / AuthenticationError が出る
def main():
    client = OpenAI()  # OPENAI_API_KEY が未設定でも起動する
```

**適用すべきでないケース:** 環境変数が任意（省略時にデフォルト動作する）場合は不要。

---

### 冪等実行フラグでの「存在前提」API は try/except でスキップする

**概要:** `delete_collection()` など対象が存在しない場合に例外を送出する API を、`--rebuild` のような冪等実行フラグ付きで呼ぶ場合は、`try/except` で握り潰してスキップログを出す。

**適用条件:** `--rebuild` / `--reset` など、存在有無に関わらず処理を完結させるべき冪等操作。

**良い例:**
```python
# OK: 存在しなくてもスキップして処理を続行
def rebuild_collection(client, name: str):
    try:
        client.delete_collection(name)
    except Exception as e:
        print(f"[skip] collection '{name}' not found or already deleted: {e}")
    client.create_collection(name)  # 削除後に再作成
```

**アンチパターン:**
```python
# NG: 存在しない場合に例外が上がって --rebuild が失敗する
def rebuild_collection(client, name: str):
    client.delete_collection(name)   # ValueError / NotFoundError が上がる
    client.create_collection(name)
```

**適用すべきでないケース:** 対象が存在すること自体が前提条件の処理では、例外をそのままスローして正しい状態を強制する。

---

### クロスプラットフォームのブラウザ起動

**概要:** `exec("open ...")` は macOS 専用。`process.platform` で OS ごとのコマンドを切り替えてクロスプラットフォームに対応する。

**適用条件:** Node.js スクリプト・CLI ツールでデフォルトブラウザを開くとき。

**良い例:**
```typescript
const openBrowser = (url: string) => {
  const cmd =
    process.platform === 'win32' ? `cmd /c start ${url}` :
    process.platform === 'linux' ? `xdg-open ${url}` :
    `open ${url}` // macOS / その他
  exec(cmd)
}
```

**アンチパターン:**
```typescript
// NG: macOS 専用コマンドをそのまま使う
exec(`open ${url}`)
```

**適用すべきでないケース:** macOS 専用ツールとして明示されている場合はシンプルに `open` でよい。

---

## アンチパターン

### `yaml.safe_load()` の戻り値を None チェックせずに使う

**問題:** 空ファイルや `---` だけの YAML を `yaml.safe_load()` に渡すと `None` が返る。直後に `.get()` を呼ぶと `AttributeError` になる。

**発生状況:** YAML 設定ファイルを読み込む CLI ツールや初期化スクリプトで、ファイルが空の状態を想定していないとき。

**悪い例:**
```python
# NG: 空 YAML → None → AttributeError
import yaml

with open("config.yaml") as f:
    data = yaml.safe_load(f)

api_key = data.get("api_key")  # data が None の場合 AttributeError
```

**良い例:**
```python
# OK: isinstance で dict かチェックしてからアクセス
import yaml

with open("config.yaml") as f:
    data = yaml.safe_load(f)

if not isinstance(data, dict):
    raise ValueError("config.yaml が空または不正なフォーマットです")

api_key = data.get("api_key")
```

**根拠:** `yaml.safe_load()` は空ファイル・`---` のみ・`null` 等で `None` を返す。`or {}` でフォールバックする (`data = yaml.safe_load(f) or {}`) も簡便だが、明示的な型チェックのほうが設定不備を早期検出できる。

---

### `async` 関数内で `threading.Lock` を使いイベントループをブロックする

**問題:** `async` 関数内で `threading.Lock` を `with lock:` で取得すると、ロック待ちの間イベントループ全体がブロックされ、他のコルーチンが実行されなくなる。

**発生状況:** `asyncio` ベースのアプリケーションで、グローバルシングルトンの遅延初期化などに `threading.Lock` を使うとき。

**悪い例:**
```python
# NG: threading.Lock がイベントループをブロック
import threading

_client = None
_lock = threading.Lock()

async def get_client():
    global _client
    if _client is None:
        with _lock:              # ロック待ちでイベントループが止まる
            if _client is None:
                _client = await init_client()
    return _client
```

**良い例:**
```python
# OK: asyncio.Lock + async with でイベントループをブロックしない
import asyncio

_client = None
_lock = asyncio.Lock()

async def get_client():
    global _client
    if _client is None:
        async with _lock:        # await で解放されるため他のコルーチンが実行できる
            if _client is None:
                _client = await init_client()
    return _client
```

**根拠:** `threading.Lock` の `acquire()` はスレッドをブロックする同期的な待機を行う。`asyncio` のイベントループはシングルスレッドのため、ロック待ちで `await` が発行されず他のコルーチンが一切実行されなくなる。`async` コンテキストでは `asyncio.Lock` + `async with` を使う。

---

### DB 書き込みとファイル保存をアトミックに扱わない

**問題:** ファイル保存成功後に DB コミットが失敗すると、ストレージに孤立ファイルが残り続ける。

**発生状況:** ファイルアップロード処理でストレージへの書き込みと DB への記録を別々に行うとき。

**悪い例:**
```python
# NG: DB 失敗時にストレージのファイルが孤立する
storage_key = store_upload(file)  # ファイル保存成功
session.commit()                  # DB 失敗 → storage_key が孤立したまま
```

**良い例:**
```python
# OK: DB 失敗時はファイルもロールバック
storage_key = store_upload(file)
try:
    session.commit()
except Exception:
    delete_stored(storage_key)  # ファイルも削除してアトミシティを保つ
    raise
```

**根拠:** ストレージと DB は別のトランザクション境界を持つため、一方の失敗が他方に伝播しない。補償トランザクションを対で実装しないと、時間経過でストレージコストが増大し整合性チェックが困難になる。

---

### CPU バウンド処理を async ハンドラ内で直接呼ぶ

**問題:** OCR・画像処理などの重い同期処理を `async def` ハンドラ内で直接実行するとイベントループがブロックされ、処理中は他のリクエストがすべて停止する。

**発生状況:** FastAPI / aiohttp などの非同期フレームワークで CPU バウンドな処理（OCR・機械学習推論・圧縮等）を呼び出すとき。

**悪い例:**
```python
# NG: イベントループをブロック → 他リクエストが数秒待たされる
@app.post("/upload")
async def upload(file: UploadFile):
    result = run_ocr(file.read())  # 重い同期処理を直接呼ぶ
    return {"text": result}
```

**良い例:**
```python
# OK: スレッドプールに委譲してイベントループを解放
import anyio

@app.post("/upload")
async def upload(file: UploadFile):
    content = await file.read()
    result = await anyio.to_thread.run_sync(run_ocr, content)
    return {"text": result}
```

**根拠:** async フレームワークのイベントループはシングルスレッドで動作する。同期のブロッキング処理を直接呼ぶと全 I/O が止まる。`anyio.to_thread.run_sync`（または `asyncio.to_thread.run_in_executor`）でスレッドプールに委譲する。

---

### グローバルインスタンスをスレッドセーフに初期化しない

**問題:** モジュールレベルのグローバル変数として重いオブジェクトを遅延初期化する場合、マルチスレッド環境では複数スレッドが同時に初期化コードに到達し、インスタンスが重複生成される。

**発生状況:** ML モデル・OCR エンジンなど起動コストが高いオブジェクトをシングルトンとしてキャッシュするとき。

**悪い例:**
```python
# NG: スレッドセーフでない遅延初期化
_model = None

def get_model():
    global _model
    if _model is None:
        _model = load_heavy_model()  # 複数スレッドが同時に実行される可能性
    return _model
```

**良い例:**
```python
# OK: threading.Lock で double-checked locking
import threading

_model = None
_lock = threading.Lock()

def get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:  # ロック取得後に再チェック
                _model = load_heavy_model()
    return _model

# OK: lifespan で一度だけ初期化して DI で渡す（より推奨）
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.model = load_heavy_model()
    yield
```

**根拠:** CPython の GIL がある場合でも `if _model is None` のチェックと代入の間に別スレッドが割り込める。lifespan フックで起動時に一度だけ初期化して DI で渡す設計のほうがテストしやすく競合の心配もない。

---

### ORM の返り値型をドメイン型へ型アサーション（`as`）で変換する

**問題:** `result.data as MyType` などの型アサーションは TypeScript の型チェックをバイパスし、フィールドの欠落や型ズレをコンパイル時に検出できなくなる。

**発生状況:** ElectroDB・Drizzle・Prisma などの ORM が `Partial<ResponseItem<...>>` のような広い型を返す場合に、export する公開型（ドメイン型）との乖離を `as` でごまかしたいとき。

**悪い例:**
```typescript
// NG: Partial<...> を as でキャスト → フィールドの欠落・undefined を握りつぶす
const result = await FormStateEntity.get({ pk, sk }).go()
return result.data as FormState // 実際には Partial<ResponseItem<...>>
```

**良い例:**
```typescript
// OK: フィールドを1つずつ取り出して明示的にマッピング
const normalizeFormState = (
  raw: Partial<ResponseItem<typeof FormStateEntity>>,
): FormState => ({
  runId: raw.runId ?? '',
  objectIndex: raw.objectIndex ?? 0,
  fields: raw.fields ?? [],
})

const result = await FormStateEntity.get({ pk, sk }).go()
return normalizeFormState(result.data)
```

**根拠:** 型アサーションは TypeScript の型安全を無効化する。ORM 返り値とドメイン型の境界には必ずマッピング関数を挟み、フィールドの欠落があればそこで実行時エラーとして検出できる構造にする。

---

### 照合・監査に必要なデータを生成時に永続化しない

**問題:** 後から照合・比較が必要になるデータを「ID や数値だけ」で保存すると、照合ステップで参照先（名前・状態）が変わっていたり取得不能になり、正しく検証できなくなる。

**発生状況:** 予想・注文・申請など「生成時点のスナップショット」を後で正解と照合する処理を実装するとき。

**悪い例:**
```typescript
// NG: 数値配列だけ保存 → 照合時に名前が取得できない
await db.insert(predictions).values({
  raceId,
  predictedOrder: [1, 2, 3],  // 馬番だけ → 後から馬名が取れない
})
```

**良い例:**
```typescript
// OK: 照合に必要な全情報をスナップショットとして保存
await db.insert(predictions).values({
  raceId,
  predictedOrder: [1, 2, 3],
  predictionsDetail: JSON.stringify([
    { rank: 1, horseName: 'アーモンドアイ', confidence: 0.85 },
    { rank: 2, horseName: 'コントレイル',   confidence: 0.72 },
  ]),
})
```

**根拠:** 外部データ（馬名・商品名・ユーザー名等）は変更・削除される可能性がある。照合・監査・履歴表示に必要な情報は、確定した瞬間のスナップショットを JSON カラム等に保存しておく。注文の商品名・価格スナップショットや承認フローの申請内容コピーも同じ原則。

---

### ユーザー入力を動的クエリのオブジェクト名・フィールド名に直接埋め込む

**問題:** SQL/SOQL などのクエリをユーザー入力から動的に組み立てる際、オブジェクト名やフィールド名をパラメータ化できない場合、regex によるホワイトリスト検証と操作種別の制限を二層で行わないとインジェクションが成立する。

**発生状況:** ORM を通さず生クエリ文字列を組み立てるとき（Salesforce SOQL・MongoDB クエリ・動的 SQL のカラム名等）。

**悪い例:**
```typescript
// NG: ユーザー入力のオブジェクト名・フィールド名を無検証でクエリに埋め込む
const result = await conn.query(`SELECT ${fields} FROM ${objectName} WHERE Id = '${id}'`)
// objectName = "Account; DELETE FROM Contact--" のような入力が通ってしまう
```

**良い例:**
```typescript
// OK: 二層で検証する
// 層1: API名（オブジェクト名・フィールド名）は英数字・アンダースコアのみ許可
const SF_API_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/
if (!SF_API_NAME.test(objectName)) throw new ValidationError('invalid object name')
fields.forEach(f => { if (!SF_API_NAME.test(f)) throw new ValidationError('invalid field') })

// 層2: クエリ種別を制限（SELECT のみ許可）
const trimmed = soql.trim().toUpperCase()
if (!trimmed.startsWith('SELECT')) throw new ValidationError('only SELECT is allowed')

// 層3: ID は専用フォーマットで検証
const SF_ID = /^[a-zA-Z0-9]{15,18}$/
if (!SF_ID.test(id)) throw new ValidationError('invalid id')

const result = await conn.query(soql)
```

**根拠:** プレースホルダが使えないクエリ言語（SOQL 等）やカラム名動的指定では、入力をクエリに埋め込む前に文字種制限（regex）と操作種別制限（SELECT のみ）の二層で検証する。一層だけでは操作種別を抜けられる。

---

### Go の nil スライスを JSON コレクションとして返す

**問題:** Go の `var items []T` 宣言は零値が `nil` であるため、`json.Marshal` が `null` を出力する。JS/TS 等のクライアントでは `null` と `[]` の扱いが異なりバグの温床になる。

**発生状況:** REST API でコレクション型のフィールドを返すとき。`nil` スライスのまま `json.Marshal` に渡す実装。

**悪い例:**
```go
// NG: var 宣言は nil → JSON で null になる
var items []Item
json.Marshal(items) // → null
```

**良い例:**
```go
// OK: make で空スライスを初期化 → JSON で [] になる
items := make([]Item, 0)
json.Marshal(items) // → []
```

**根拠:** Go クライアントは `null` を問題なく処理するが、JS/TS では `null.map(...)` でクラッシュする。コレクション型は `make([]T, 0)` で初期化して常に `[]` を返す設計にする。

---

### 環境変数の数値パースを検証なしで使う

**問題:** `Number(process.env.FOO)` は env が未設定・空・文字列のとき `NaN` になる。`NaN` はあらゆる数値比較をすり抜けるため、無効な設定が実行時まで検出されない。

**発生状況:** 環境変数から数値（ポート・タイムアウト・リミット等）を読み取るとき。

**悪い例:**
```typescript
// NG: FOO が未設定 or 空のとき NaN になり比較もすり抜ける
const timeout = Number(process.env.TIMEOUT_MS)
if (timeout > 0) { /* NaN > 0 = false で通り抜ける */ }
```

**良い例:**
```typescript
// OK: Number.isFinite で検証してフォールバック
const DEFAULT_TIMEOUT = 5000
const parsed = Number(process.env.TIMEOUT_MS)
const timeout = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT
```

**根拠:** `Number("")` → `0`、`Number(undefined)` → `NaN`。NaN はすべての数値比較で false を返すため、バリデーションをすり抜けて無効な設定値として動作し続ける。`Number.isFinite` で検証してからデフォルト値にフォールバックする。

---

### Node.js HTTP ハンドラ内で `process.exit()` を直接呼ぶ

**問題:** `res.end()` の直後に `process.exit()` を呼ぶと、レスポンスのバッファが flush される前にプロセスが終了し、クライアントが応答を受け取れない可能性がある。

**発生状況:** エラー時に HTTP レスポンスを返してからプロセスを終了させたいとき。

**悪い例:**
```typescript
// NG: res.end() 後に即 exit → バッファが flush されない可能性
res.writeHead(500)
res.end('Internal Error')
process.exit(1) // レスポンス未到達でプロセス終了
```

**良い例:**
```typescript
// OK: exitCode をセットして server.close() に委ねる
res.writeHead(500)
res.end('Internal Error')
process.exitCode = 1
server.close() // 既存接続完了後にプロセスを終了させる
return
```

**根拠:** `res.end()` はレスポンスの書き込みをキューに積むだけで即時 flush されない。`process.exit()` はキューを無視して強制終了するため、クライアントがレスポンスを受け取れないことがある。`process.exitCode` + `server.close()` で既存接続の完了を待ってから終了させる。

---

### URL の同一性比較で trailing slash のみを正規化する

**問題:** `strings.TrimRight(u, "/")` で末尾スラッシュだけ除去する比較では、大文字・小文字の差異（`HTTPS://` vs `https://`）や二重スラッシュが考慮されず、同一 URL を別物と判定することがある。

**発生状況:** Go で URL を正規化してから比較するとき。

**悪い例:**
```go
// NG: trailing slash のみ除去 → 大文字・小文字を考慮しない
a := strings.TrimRight(rawA, "/")
b := strings.TrimRight(rawB, "/")
return a == b // "HTTPS://example.com" vs "https://example.com" を別物と判定
```

**良い例:**
```go
// OK: url.Parse + strings.ToLower で正規化してから比較
import "net/url"

func normalizeURL(raw string) string {
    u, err := url.Parse(strings.ToLower(raw))
    if err != nil {
        return strings.ToLower(strings.TrimRight(raw, "/"))
    }
    u.Path = strings.TrimRight(u.Path, "/")
    return u.String()
}

return normalizeURL(rawA) == normalizeURL(rawB)
```

**根拠:** URL の同一性比較は trailing slash だけでなく scheme の大文字・小文字、二重スラッシュ等のパターンも正規化する必要がある。`url.Parse` + `strings.ToLower` を組み合わせてからパス部分の trailing slash を除去する。

---

### 外部 API のエラーを `null` でサイレントに握り潰す

**問題:** `try/catch` 内で `null` を返すだけでは、呼び出し側が「データなし」と「取得失敗」を区別できない。エラーが黙殺され障害調査が困難になる。

**発生状況:** Drive API・外部ストレージ・外部 HTTP API など失敗しうる取得処理を共通関数でラップするとき。

**悪い例:**
```typescript
// NG: エラーが null に変換されて消える → 呼び出し側は原因不明
async function fetchFileContent(fileId: string): Promise<string | null> {
  try {
    return await drive.files.get({ fileId })
  } catch {
    return null // エラーが握り潰される
  }
}
```

**良い例:**
```typescript
// OK: discriminated union でエラーを明示的に伝える
type FetchResult =
  | { text: string; fetchError: null }
  | { text: null; fetchError: string }

async function fetchFileContent(fileId: string): Promise<FetchResult> {
  try {
    const text = await drive.files.get({ fileId })
    return { text, fetchError: null }
  } catch (e) {
    return { text: null, fetchError: String(e) }
  }
}

// 呼び出し側でエラーを明示的に処理できる
const result = await fetchFileContent(id)
if (result.fetchError) {
  logger.error('fetch failed', { error: result.fetchError })
  return
}
process(result.text)
```

**根拠:** `null` だけを返すと「データなし」と「取得失敗」が区別できず、エラーを黙殺したまま動作し続ける。discriminated union で返すと型レベルでエラー処理が強制され、ログ記録・ユーザーへの通知を確実に行える。

---

### バリデーション制約を派生スキーマのみに追加して共通ベースに反映しない

**問題:** 新しいエンドポイント用の派生スキーマにのみバリデーション制約を追加すると、共通ベーススキーマを使う他のエンドポイントとの間でバリデーション厳格度がズレる。

**発生状況:** 既存の共通スキーマを継承してエンドポイント固有のスキーマを作るとき。

**悪い例:**
```python
# NG: 派生スキーマにだけ制約を追加 → ベーススキーマを使う他エンドポイントは緩いまま
class WorkRecordBase(BaseModel):
    work_date: str  # 制約なし

class WorkRecordCreate(WorkRecordBase):
    work_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")  # 派生のみ
```

**良い例:**
```python
# OK: 共通ベーススキーマに制約を入れて全エンドポイントに適用する
class WorkRecordBase(BaseModel):
    work_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")  # ベースに定義

class WorkRecordCreate(WorkRecordBase):
    pass  # 制約を上書きしなくてよい
```

**根拠:** バリデーション制約を派生スキーマのみに追加すると、ベーススキーマを使う PUT・PATCH 等の別エンドポイントではバリデーションがかからない。不整合なデータが混入するリスクを避けるため、制約はベーススキーマに定義する。

---
