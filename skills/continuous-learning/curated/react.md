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
