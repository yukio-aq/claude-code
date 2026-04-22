# Curated Anti-Patterns

繰り返し発生した問題パターンと回避方法。
instincts/ で確認済みのもののみ記載する。

---

<!--
## アンチパターン追加テンプレート

### アンチパターン名

**問題:** 何が問題か（1〜2文）

**発生状況:** どういう状況・コードで起きるか

**悪い例:**
```typescript
// NG
```

**良い例:**
```typescript
// OK
```

**根拠:** なぜ問題なのか。何度発生したか。

---
-->

## SQLite を本番環境の最初から採用する

**問題:** プロトタイプで SQLite を使い始めると、本番移行時に PostgreSQL への移行コストが発生する。JSONB・高度なインデックス・full-text search など PostgreSQL 固有の機能も使えない。

**発生状況:** 「まず動くものを作りたい」「セットアップが楽だから」という理由で SQLite を選択したとき。

**悪い例:**
```typescript
// NG: 本番運用を見据えたプロジェクトで SQLite を採用
// drizzle.config.ts
export default { dialect: 'sqlite', dbCredentials: { url: './local.db' } }
```

**良い例:**
```typescript
// OK: 最初から PostgreSQL を採用（Drizzle + Docker で初期コストは低い）
// drizzle.config.ts
export default { dialect: 'postgresql', dbCredentials: { url: process.env.DATABASE_URL } }

// docker-compose.yml に postgres サービスを追加するだけで開発環境が揃う
```

**根拠:** 複数セッションで「SQLite は本番移行コストがあるため PostgreSQL を採用」という決定が繰り返し発生。開発初期のセットアップコストは Docker で吸収できる。

---

## ローディング state のリセットを `catch` 節だけで行う

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
    setLoading(false) // 成功・失敗どちらでも必ず実行
  }
}
```

**根拠:** 複数プロジェクトで「ローディング固着バグ」として観測。`finally` を使う習慣で完全に防止できる。

---

## Tailwind のカラーをデザイントークンを使わずハードコードする

**問題:** `bg-blue-500` 等を直接プライマリカラーに使うと、shadcn/ui のテーマ・ダークモード切り替えが効かなくなり、全カラー変更時に手作業で全ファイルを修正する必要が生じる。

**発生状況:** デザインシステムを意識せず「とりあえず動く色」で実装するとき。

**悪い例:**
```typescript
// NG: 具体的な色をハードコード
<Button className="bg-blue-500 hover:bg-blue-600 text-white">送信</Button>
<Badge className="bg-green-100 text-green-800">完了</Badge>
```

**良い例:**
```typescript
// OK: デザイントークンを使う（テーマ・ダークモードが自動で機能する）
<Button className="bg-primary hover:bg-primary/90 text-primary-foreground">送信</Button>
<Badge className="bg-success/10 text-success">完了</Badge>
```

**根拠:** shadcn/ui は CSS 変数ベースのテーマ設計。ハードコードカラーはテーマ切り替え・ダークモード対応を壊す。ブランドカラー変更時の修正コストも数倍になる。

---

## Hero → Features（3列グリッド）→ CTA の固定レイアウトを使い回す

**問題:** LP・ダッシュボード問わず同じページ構成を使い続けると、コンテンツの優先順位が無視され「AI生成感」が出る。

**発生状況:** ページ構成を「よくあるランディングページの例」から組み立てるとき。

**悪い例:**
```typescript
// NG: コンテンツに関わらず毎回同じ構成
<HeroSection />
<section className="grid grid-cols-3 gap-6">
  {features.map((f) => <FeatureCard key={f.id} {...f} />)}
</section>
<CtaSection />
```

**良い例:**
```typescript
// OK: コンテンツの性質に合わせて構成を変える
// 例: 比較が主目的なら非対称レイアウト
<section className="grid grid-cols-[3fr_2fr] gap-12 items-start">
  <MainContent />
  <SidePanel />
</section>

// 例: ストーリー性があるなら縦スクロール＋ブレイクポイントで変化をつける
<section className="space-y-24">
  <StepOne className="flex-row" />
  <StepTwo className="flex-row-reverse" />
</section>
```

**根拠:** レイアウトはコンテンツの意味を視覚的に表現する手段。固定テンプレは「コンテンツがレイアウトに従う」逆転を引き起こし、情報の優先順位が伝わらなくなる。

---

## すべてのコンポーネントに `rounded-lg shadow-md` を無差別に適用する

**問題:** 要素の役割に関わらず同じ装飾を全コンポーネントに当てると、視覚的な階層が消え「のっぺり感」が出る。

**発生状況:** スタイルを「とりあえずカードっぽく見せたい」という動機で追加するとき。

**悪い例:**
```typescript
// NG: 役割が異なる要素に同じ装飾
<nav className="rounded-lg shadow-md p-4 bg-white">...</nav>
<aside className="rounded-lg shadow-md p-4 bg-white">...</aside>
<li className="rounded-lg shadow-md p-4 bg-white">...</li>
```

**良い例:**
```typescript
// OK: 役割に合わせた装飾（影・角丸の強度で階層を表現）
<nav className="border-b border-border bg-background">...</nav>  // ナビは境界線のみ
<aside className="rounded-xl border border-border p-4">...</aside>  // サイドバーは控えめ
<li className="rounded-md border border-border/60 p-3 hover:border-border">...</li>  // リストは最小限
```

**根拠:** 影と角丸は「浮き上がり」と「柔らかさ」を表す視覚的な重みを持つ。全要素に同じ強度で当てると奥行きの情報がなくなり、ユーザーが「どこが操作対象か」を判断しにくくなる。

---

## ローディング状態を `<Spinner />` だけで表現する

**問題:** Spinner はコンテンツ領域を空にするため、データ取得完了時にレイアウトシフトが発生する。ユーザーは「何が読み込まれるのか」が分からない。

**発生状況:** 非同期データ取得のローディング UI を実装するとき。

**悪い例:**
```typescript
// NG: Spinner のみ → コンテンツ領域が空になりレイアウトシフト発生
{isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
{!isLoading && <Card data={data} />}
```

**良い例:**
```typescript
// OK: Skeleton でレイアウトを維持（何が来るかの予告にもなる）
{isLoading ? (
  <div className="space-y-3">
    <Skeleton className="h-5 w-48" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
  </div>
) : (
  <Card data={data} />
)}
```

**根拠:** Skeleton はコンテンツが入るスペースを確保し続けるためレイアウトシフトがない。また「何かが来る」という予告になり体感速度が改善する（Progressive Loading）。

---

## 空状態を "No data found." の 1 行で済ませる

**問題:** 空状態にアクションがないと、ユーザーは「壊れているのか、データがないのか、何をすればいいのか」が分からず離脱する。

**発生状況:** リストや検索結果が空のときの表示を実装するとき。

**悪い例:**
```typescript
// NG: 理由もアクションもない
{items.length === 0 && <p className="text-center text-gray-500">No data found.</p>}
```

**良い例:**
```typescript
// OK: コンテキストに応じたアイコン＋説明＋CTA
{items.length === 0 && (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <InboxIcon className="w-10 h-10 text-muted-foreground" />
    <div>
      <p className="font-medium">まだタスクがありません</p>
      <p className="text-sm text-muted-foreground">最初のタスクを追加してみましょう</p>
    </div>
    <Button variant="outline" onClick={onCreate}>タスクを作成</Button>
  </div>
)}
```

**根拠:** 空状態はコンバージョンの好機。CTA を置くことで「次にすること」が明確になり、ユーザーの離脱率が下がる。検索結果の場合は「絞り込みを緩める」等の別アクションが適切。

---

## React の `key` に動的リストで `index` を無条件に使う

**問題:** 並べ替え・フィルタが発生するリストで `index` を `key` にすると、コンポーネントの同一性が崩れてフォームの値が別アイテムに吸い付くなどのバグが発生する。

**発生状況:** リストレンダリング時に「とりあえず `index` を使えばエラーが消える」と対処したとき。

**悪い例:**
```typescript
// NG: ソート・フィルタ可能なリストで index を使う
users
  .filter((u) => u.active)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((u, i) => <UserRow key={i} user={u} />) // index がずれてバグ
```

**良い例:**
```typescript
// OK: ID を使う
users.map((u) => <UserRow key={u.id} user={u} />)

// OK: 固定長・順序不変の入力フォームは index で安定化
workItems.map((item, i) => <WorkItemInput key={`work-item-${i}`} item={item} />)
```

**根拠:** 「key 方針」として複数セッションで議論・決定が繰り返し発生。ID がある場合は ID、なければコンテンツ文字列や複合キーを使う。index が適切なのは固定長・並べ替えなしの配列に限る。

---

## ファイル保存フックにプロジェクト全体解析ツールを実行させる

**問題:** `tsc --noEmit` や `mypy` はプロジェクト全ファイルを解析するため、ファイル保存ごとに実行すると数秒〜数十秒かかりワークフローを詰まらせる。

**発生状況:** PostToolUse・pre-commit などのファイル保存フックに型チェックを追加したいとき。

**悪い例:**
```javascript
// NG: tsc は全ファイル対象 → 1ファイル保存のたびにプロジェクト全体を解析
if (["ts", "tsx"].includes(ext) && existsSync(tsconfigPath)) {
  const tsc = run("npx", ["tsc", "--noEmit", "--skipLibCheck"]);
  // ...
}
```

**良い例:**
```javascript
// OK: Prettier は単一ファイルを即時処理 → フックに適している
if (isInstalled("prettier")) {
  run("prettier", ["--write", filePath]);
}

// tsc は実装完了時に手動実行 or CI に委ねる
// → package.json の scripts か Makefile に置く
// "typecheck": "tsc --noEmit"
```

**根拠:** tsc にはシングルファイルモードがなく、`--noEmit` でも必ずプロジェクト全体を解析する。`npx` 経由だとさらに起動オーバーヘッドが加わる。フックに入れるべきは「単一ファイルを即時処理できるツール」（Prettier・Ruff・ESLint `--fix`）に限定し、全体解析は CI か実装完了時の手動実行に委ねる。

---

## ESM プロジェクトの `vi.mock` ファクトリ内で `require()` を使う

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

**根拠:** ESM では `require` が存在しないため実行時エラーになる。`vi.mock` のファクトリは巻き上げ（hoist）されるため通常の `import` も使えず、動的 `import()` が唯一の手段。Node.js 組み込みモジュール（`fs`, `path` 等）も同じパターンで対応できる。

---

## `expect(promise).rejects` ハンドラをタイマー実行後にアタッチする

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

## DB 書き込みとファイル保存をアトミックに扱わない

**問題:** ファイル保存成功後に DB コミットが失敗すると、ストレージに孤立ファイルが残り続ける。逆順でも DB 書き込み後にファイル保存が失敗すると DB にゴミレコードが残る。

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

**根拠:** ストレージと DB は別のトランザクション境界を持つため、一方の失敗が他方に伝播しない。補償トランザクション（失敗時の逆操作）を対で実装しないと、時間経過でストレージコストが増大し、整合性チェックが困難になる。

---

## CPU バウンド処理を async ハンドラ内で直接呼ぶ

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

**根拠:** async フレームワークのイベントループはシングルスレッドで動作する。同期のブロッキング処理を直接呼ぶと、完了するまで全 I/O が止まる。`anyio.to_thread.run_sync`（または `asyncio.to_thread.run_in_executor`）でスレッドプールに委譲することで並列性を維持できる。

---

## エラー時にモックデータへサイレントフォールバックする

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

**根拠:** フォールバックはエラーを隠蔽する。モックに切り替わった瞬間から「動いているように見えるが実際は壊れている」状態になり、根本原因の発見が著しく遅れる。エラーは必ず `error` state にセットして UI で表示する。開発中だけモックを使いたい場合は環境変数フラグで明示的に切り替える。

---

## グローバルインスタンスをスレッドセーフに初期化しない

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
    # クリーンアップ処理をここに書く
```

**根拠:** CPython の GIL がある場合でも、`if _model is None` のチェックと代入の間に別スレッドが割り込める。lifespan フックで起動時に一度だけ初期化して DI で渡す設計のほうがテストしやすく、競合の心配もない。

---

## 照合・監査に必要なデータを生成時に永続化しない

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
    { rank: 3, horseName: 'グランアレグリア', confidence: 0.68 },
  ]),
})
```

**根拠:** 外部データ（馬名・商品名・ユーザー名等）は変更・削除される可能性がある。照合・監査・履歴表示に必要な情報は、生成・確定した瞬間のスナップショットを JSON カラム等に保存しておく。注文の商品名・価格スナップショットや、承認フローの申請内容コピーも同じ原則。

---
