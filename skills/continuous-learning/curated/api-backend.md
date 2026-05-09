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

## アンチパターン

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
