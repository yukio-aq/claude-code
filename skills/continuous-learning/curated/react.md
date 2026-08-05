---
last_updated: 2026-05-09
confidence: high
review_after: 2026-11-09
---

# React — パターン & アンチパターン

React コンポーネント・状態管理・ブラウザ API 連携に関するパターン。
frontend-implementer / frontend-reviewer が参照する。

---

## パターン

### React の `key` はリストの性質に合わせて選ぶ

**概要:** `key` の選び方を誤るとコンポーネントの同一性が崩れて再レンダリングバグが発生する。リストの性質ごとに使い分ける。

**適用条件:** React のリストレンダリング全般。

**良い例:**
```typescript
// ID がある動的リスト → ID を使う（最優先）
users.map((u) => <UserRow key={u.id} user={u} />)

// 表示専用リスト（並べ替えなし）→ コンテンツ文字列
items.map((item) => <Tag key={item} label={item} />)

// File リスト → name + lastModified の組み合わせ（同名ファイルの重複対策）
files.map((f) => <FileItem key={`${f.name}-${f.lastModified}`} file={f} />)

// 固定長・並べ替えなしの入力フォーム配列 → index で安定化
workItems.map((item, i) => <WorkItemInput key={`work-item-${i}`} item={item} />)
```

**アンチパターン:**
```typescript
// NG: 並べ替え・フィルタが発生するリストで index を使う
users
  .filter((u) => u.active)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((u, i) => <UserRow key={i} user={u} />) // 並べ替え時にバグ
```

**適用すべきでないケース:** 固定長で順序も変わらない入力フォーム配列は index が適切。

---

### ファイル input の同一ファイル再選択バグを `input.value = ''` で解消する

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

### "その他" 入力を持つ Select は選択意図と値を独立した state で管理する

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

### Remember me は localStorage、セッション限定は sessionStorage を使い分ける

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

### モーダルはフォーカス管理・キーボードトラップ・Escape キーをセットで実装する

**概要:** モーダルを開いたときのフォーカス移動、Tab キーによるモーダル内循環、Escape キーでの閉じ機能を必ずセットで実装する（WCAG 2.1 APG Dialog Pattern）。

**適用条件:** ダイアログ・モーダル・ドロワーなど、バックグラウンドコンテンツをブロックするオーバーレイ実装全般。

**良い例:**
```typescript
// shadcn/ui の Dialog は Radix UI ベースで三要件を内包している
import { Dialog, DialogContent } from '@/components/ui/dialog'

// カスタム実装の場合
useEffect(() => {
  if (!open) return
  const el = modalRef.current?.querySelector<HTMLElement>('[autofocus], button, [href]')
  el?.focus() // フォーカスをモーダル内最初の要素へ移動

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Tab') trapFocus(e, modalRef.current) // Tab をモーダル内に閉じ込める
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [open])
```

**アンチパターン:**
```typescript
// NG: 表示切り替えだけでフォーカス管理なし → スクリーンリーダーでモーダルが認識されない
{isOpen && (
  <div className="fixed inset-0 bg-black/50">
    <div className="bg-white p-4">
      <button onClick={onClose}>×</button>
    </div>
  </div>
)}
```

**適用すべきでないケース:** Toast・Tooltip など非インタラクティブな浮き要素にはフォーカストラップ不要。shadcn/ui の Dialog・Sheet 等を使う場合は既に対応済みのため個別実装不要。

---

### React Query の queryKey は階層配列で統一する

**概要:** queryKey を `["domain", "subDomain", id]` のような階層配列で定義することで、上位キーで関連するクエリをまとめて無効化できる。

**適用条件:** TanStack Query（React Query）を使うすべてのプロジェクト。

**良い例:**
```typescript
// 階層配列で定義 → ドメイン単位の一括無効化が可能
const { data: formState } = useQuery({
  queryKey: ['adapter', 'formState', runId],
})
const { data: users } = useQuery({
  queryKey: ['adapter', 'users', runId],
})

// 'adapter' 以下を全無効化
queryClient.invalidateQueries({ queryKey: ['adapter'] })
// 特定 run のフォーム状態だけ無効化
queryClient.invalidateQueries({ queryKey: ['adapter', 'formState', runId] })
```

**アンチパターン:**
```typescript
// NG: フラット文字列 → 関連クエリをまとめて無効化できない
const { data } = useQuery({ queryKey: ['formState'] })
```

**適用すべきでないケース:** クエリが1〜2種類しかなく、関連性による一括無効化が不要なほどシンプルなケース。

---

### React Query `enabled` で依存値が揃うまでクエリを停止する

**概要:** `enabled: !!dependency` を使って、必要なパラメータが揃ってからクエリを実行する。undefined のまま API を叩くことを防ぐ。

**適用条件:** クエリのパラメータが非同期で確定する場合（URL パラメータ・ユーザー選択・ルート遷移後に決まる値）。

**良い例:**
```typescript
const { runId } = useParams()

const { data } = useQuery({
  queryKey: ['adapter', 'formState', runId],
  queryFn: () => fetchFormState(runId!),
  enabled: !!runId, // runId が確定するまでクエリを停止
})
```

**アンチパターン:**
```typescript
// NG: 依存値チェックなし → runId が undefined のまま API を叩く
const { data } = useQuery({
  queryKey: ['adapter', 'formState', runId],
  queryFn: () => fetchFormState(runId!),
})
```

**適用すべきでないケース:** パラメータが常に存在することが保証されている場合（ルート定義で必須の path param 等）。

---

### API 通信は共通ラッパー経由に集約する

**概要:** `fetch('/api/...')` をコンポーネントや route で直接呼ばず、`lib/api.ts` 等の共通ラッパー経由で行う。エラー処理・ベース URL・認証ヘッダーを一箇所に集約できる。

**適用条件:** フロントエンドで複数箇所から API を呼び出すプロジェクト全般。

**良い例:**
```typescript
// lib/api.ts
export const apiFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// 呼び出し側は api.ts 経由のみ
import { apiFetch } from '@/lib/api'
const users = await apiFetch<User[]>('/users')
```

**アンチパターン:**
```typescript
// NG: コンポーネント内で直接 fetch → エラー処理が各所に散らばる
const res = await fetch(`${BASE_URL}/users`)
if (!res.ok) throw new Error(...)
const data = await res.json()
```

**適用すべきでないケース:** Next.js の Server Actions で直接 DB を操作するケースや、外部ドメインへの1回限りの fetch など、ラッパーが不要なほどシンプルな場合。

---

### useEffect 内の fetch は AbortController でキャンセルする（StrictMode 対策）

**概要:** useEffect 内で fetch を発行するとき AbortController を使い、cleanup でキャンセルする。React StrictMode の二重マウントでも状態更新が走らず副作用が二重実行されない。

**適用条件:** useEffect 内で fetch を発行するとき全般。特に React StrictMode（開発環境）では二重マウントが発生するため必須。

**良い例:**
```typescript
useEffect(() => {
  const controller = new AbortController()
  const run = async () => {
    try {
      const res = await fetch(url, { method: 'POST', signal: controller.signal })
      const data = await res.json()
      setState(data)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return // 正常なキャンセル → 握り潰す
      throw err
    }
  }
  run()
  return () => { controller.abort() } // unmount 時に fetch をキャンセル
}, [url])
```

**アンチパターン:**
```typescript
// NG: cleanup なし → StrictMode で二重 POST が発行される
useEffect(() => {
  fetch(url, { method: 'POST' }).then(r => r.json()).then(setState)
}, [url])
```

**適用すべきでないケース:** fetch ではなく副作用がタイマーベースの場合（その場合は releaseTimerRef パターンを使う）。

---

### StrictMode 二重発火の cleanup 遅延は releaseTimerRef パターンで防ぐ

**概要:** React StrictMode は開発環境で useEffect を mount→unmount→mount と二重発火させる。cleanup でリソース解放リクエスト（ロック解除・セッション終了等）を送る場合、即時送信すると再マウント時に誤って解放してしまう。`setTimeout(0)` で遅延させ、再マウント時に `clearTimeout` でキャンセルする。

**適用条件:** useEffect の cleanup でサーバーへリクエストを送る場合（ロック解除・セッション終了・アナリティクス送信等）。

**良い例:**
```typescript
const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

useEffect(() => {
  acquireLock()
  return () => {
    // StrictMode の即時 unmount では再マウントが来るため遅延させる
    releaseTimerRef.current = setTimeout(() => {
      releaseLock()
    }, 0)
  }
}, [])

// 再マウント時（StrictMode）はタイマーをキャンセルして解放しない
useEffect(() => {
  if (releaseTimerRef.current) {
    clearTimeout(releaseTimerRef.current)
    releaseTimerRef.current = null
  }
}, [])
```

**アンチパターン:**
```typescript
// NG: cleanup で即時解放 → StrictMode で mount→unmount→mount が発生すると
//     unmount 時にロックが解除され、再マウント後は未ロック状態になる
useEffect(() => {
  acquireLock()
  return () => { releaseLock() }
}, [])
```

**適用すべきでないケース:** AbortController でキャンセルできる in-flight fetch には不要。本番環境（StrictMode なし）では二重発火しないため問題は顕在化しないが、開発環境の再現性のために常に実装する。

---

### タブ閉じ時の認証付きリクエストは `fetch(keepalive: true)` を使う

**概要:** `navigator.sendBeacon` はタブ閉じ時に確実に送信されるが、`Authorization` などのカスタムヘッダーを付けられない。認証ヘッダーが必要な場合は `fetch(url, { keepalive: true })` を使う。

**適用条件:** ページ離脱時（`beforeunload`・useEffect cleanup）に認証付きリクエストを送る場合。

**良い例:**
```typescript
// タブ閉じ・ページ離脱時に認証付きで送信
const sendBeforeUnload = (token: string) => {
  fetch('/api/sessions/end', {
    method: 'POST',
    keepalive: true, // ページ終了後もリクエストを完遂させる
    headers: { Authorization: `Bearer ${token}` },
  })
}

window.addEventListener('beforeunload', () => sendBeforeUnload(tokenRef.current))
```

**アンチパターン:**
```typescript
// NG: sendBeacon はカスタムヘッダー不可 → 認証が必要なエンドポイントに使えない
navigator.sendBeacon('/api/sessions/end', JSON.stringify({ data }))
// Authorization ヘッダーを付ける手段がなく、401 になる
```

**適用すべきでないケース:** 認証不要なエンドポイントへの送信（アナリティクス等）は `sendBeacon` のほうがシンプル。

---

### state を追加したら set / read / reset の3点セットを確認する

**概要:** 新しい state を追加するとき、セットする箇所・読む箇所・リセットする箇所の3点が揃っているかを確認する。どれか1つが欠けると state が意図通りに動作しない。

**適用条件:** React コンポーネントや状態管理に新しい state を追加するとき全般。

**良い例:**
```typescript
const [loadedId, setLoadedId] = useState<string | null>(null)

// set — ロード完了時にセット
const handleLoad = (id: string) => {
  setLoadedId(id)
}

// read — 現在の state を参照して判定
const isLoaded = loadedId === currentId

// reset — 初期状態に戻す
const handleReset = () => {
  setLoadedId(null)
}
```

**アンチパターン:**
```typescript
// NG: setLoadedId(id) を呼ぶ箇所がない → loadedId は常に null のまま
const [loadedId, setLoadedId] = useState<string | null>(null)

// set する箇所が存在しない

const isLoaded = loadedId === currentId  // 常に false になる
```

**適用すべきでないケース:** `useMemo` 等で導出される読み取り専用の派生 state や、append-only でリセットが不要な state にはこのチェックは当てはまらない。

---

## アンチパターン

### SPA ルーターで `<a href>` を使う

**問題:** React Router / TanStack Router を使うプロジェクトで `<a href="...">` を使うとフルページリロードになり、クライアントサイドナビゲーションが無効化される。

**発生状況:** ナビゲーションリンクを実装するとき、慣習的に `<a>` タグを使ってしまうとき。

**悪い例:**
```typescript
// NG: フルリロードが発生し prefetch・スクロール位置保持・ルートキャッシュが無効になる
<a href="/dashboard">ダッシュボード</a>
```

**良い例:**
```typescript
// OK: クライアントサイドナビゲーション
import { Link } from '@tanstack/react-router'
<Link to="/dashboard">ダッシュボード</Link>
```

**根拠:** `<a>` タグはブラウザのデフォルト遷移を引き起こし SPA の恩恵が失われる。外部リンク・`download` 属性が必要なケースは `<a>` を使う。

---

### React Query でクライアントサイドフィルタリング時に queryKey を固定にする

**問題:** queryKey を検索条件と無関係に固定すると、2回目の同一条件検索でキャッシュが返り再フェッチが走らない。ユーザーの操作が無視される。

**発生状況:** React Query でフィルタ・検索ボタンを押すたびにデータを取得し直したいとき。

**悪い例:**
```typescript
// NG: queryKey が固定 → 検索ボタンを押しても2回目はキャッシュが返る
const { data } = useQuery({
  queryKey: ['items'],  // 検索条件が含まれていない
  queryFn: () => fetchItems(searchTerm),
})
const handleSearch = () => refetch()  // stale でなければ再実行されない
```

**良い例:**
```typescript
// OK: invalidateQueries で確実にキャッシュを無効化して再実行させる
const queryClient = useQueryClient()
const { data } = useQuery({
  queryKey: ['items', searchTerm],
  queryFn: () => fetchItems(searchTerm),
})
const handleSearch = () => {
  queryClient.invalidateQueries({ queryKey: ['items'] })
}
```

**根拠:** React Query はキャッシュが fresh な間は再フェッチしない。検索条件を queryKey に含めるか、`invalidateQueries` で明示的にキャッシュを無効化しないと、同一条件での再検索が機能しない。

---

### useMutation の pending 状態を個別のローカル state で管理する

**問題:** 承認・却下など複数のミューテーションの pending を独立したローカル state で管理すると、`onMutate` の非同期タイミングで state 更新が間に合わず両ボタンが同時押しできる競合が生じる。

**発生状況:** 承認・却下・削除など排他的な複数アクションを持つリストアイテムの UI。

**悪い例:**
```typescript
// NG: ローカル state で管理 → タイミング競合で両ボタンが同時に押せる
const [processingId, setProcessingId] = useState<string | null>(null)

const handleApprove = (id: string) => {
  setProcessingId(id)
  approveMutation.mutate(id)
}

<button disabled={processingId === item.id} onClick={() => handleApprove(item.id)}>承認</button>
<button disabled={processingId === item.id} onClick={() => handleReject(item.id)}>却下</button>
```

**良い例:**
```typescript
// OK: ミューテーション自体の isPending で一元管理する
const approveMutation = useMutation({ mutationFn: approve })
const rejectMutation = useMutation({ mutationFn: reject })
const isProcessing = approveMutation.isPending || rejectMutation.isPending

<button disabled={isProcessing} onClick={() => approveMutation.mutate(item.id)}>承認</button>
<button disabled={isProcessing} onClick={() => rejectMutation.mutate(item.id)}>却下</button>
```

**根拠:** `useMutation` の `isPending` はミューテーション実行中に確実に `true` になる。独自のローカル state は非同期タイミングのズレで更新が遅れることがあり、競合が発生する。ミューテーション自体が持つ状態を使うのが正確。

---

### 戻り先 state を渡す navigate() の呼び出し元を一部だけ対応する

**問題:** 詳細画面への遷移で戻り先を `state.from` として渡す設計にした場合、同じ遷移先を呼び出す箇所が複数タブ・複数コンポーネントに分散していると一部で渡し漏れが起きる。漏れた経路から遷移したユーザーだけ「戻る」が機能しなくなる。

**発生状況:** 複数タブを持つ一覧画面など、同じ詳細/編集画面への `navigate()` 呼び出しがコンポーネント内に複数箇所存在するとき。

**悪い例:**
```typescript
// Tab A: 戻り先を渡している
navigate(`/items/${id}`, { state: { from: location } })

// Tab B: 同じ画面への遷移だが渡し漏れ → このタブ経由だと「戻る」が機能しない
navigate(`/items/${id}`)
```

**良い例:**
```typescript
// 共通の遷移関数に集約し、呼び出し元によらず必ず state.from を渡す
const goToItem = (id: string) => navigate(`/items/${id}`, { state: { from: location } })

// Tab A / Tab B とも同じ関数を呼ぶだけにする
<button onClick={() => goToItem(item.id)}>詳細</button>
```

**根拠:** 同じ遷移ロジックをタブ・コンポーネントごとにインラインで書くと、追加や修正のたびに一部だけ渡し漏れが発生しやすい。遷移処理を共通関数に集約すれば、呼び出し元を増やしても渡し忘れが起きない。

---
