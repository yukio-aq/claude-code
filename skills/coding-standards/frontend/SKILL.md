---
name: frontend-coding-standards
description: React/Next.jsのコーディングスタンダード。frontend-implementer / frontend-reviewer が参照する。
---

# フロントエンド コーディングスタンダード（React / Next.js）

## コンポーネント設計

### 分類と配置

```
components/ui/        汎用UIコンポーネント（ボタン・モーダル等）
components/feature/   機能特化コンポーネント
app/ or pages/        ルートコンポーネント（ロジックを持たせない）
hooks/                カスタムフック
```

### 単一責務の基準

- 1コンポーネント1つの関心事
- 200行を超えたら分割を検討
- propsが7つを超えたら責務が広すぎるサイン

### ロジックの分離

```typescript
// ❌ コンポーネントにロジックを詰め込む
const UserList = () => {
  const [users, setUsers] = useState([])
  useEffect(() => { /* fetch logic */ }, [])
  const handleDelete = async (id) => { /* delete logic */ }
  return <div>...</div>
}

// ✅ カスタムフックにロジックを分離
const useUsers = () => {
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const handleDelete = useCallback(async (id: string) => { ... }, [])
  return { users: data ?? [], isLoading, handleDelete }
}

const UserList = () => {
  const { users, isLoading, handleDelete } = useUsers()
  if (isLoading) return <UserListSkeleton />
  return (
    <ul aria-label="ユーザー一覧">
      {users.map(u => <UserItem key={u.id} user={u} onDelete={handleDelete} />)}
    </ul>
  )
}
```

## 状態管理の使い分け

| 状態の種類                     | 推奨            |
| ------------------------------ | --------------- |
| サーバーデータのキャッシュ     | TanStack Query  |
| グローバルUI状態（モーダル等） | Zustand         |
| フォーム状態                   | React Hook Form |
| URL状態                        | nuqs（Next.js） |
| ローカルコンポーネント状態     | useState        |

## パフォーマンス

- `useCallback` / `useMemo` は計測後に適用（闇雲に使わない）
- `key` には配列インデックスを使わない（安定したIDを使う）
- 大きなリストは仮想化（`react-window` / `@tanstack/virtual`）
- Dynamic Importで初期バンドルを削減
- 画像は必ず `next/image`

## アクセシビリティ（デフォルトで対応）

- インタラクティブ要素には必ず `aria-label` を付ける
- フォームの `<input>` には必ず `<label>` を対応させる
- カラーコントラスト比 4.5:1 以上
- キーボード操作に対応する
