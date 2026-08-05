---
name: tanstack-router
description: >
  TanStack Router のベストプラクティス・ルート定義・型安全ルーティングパターン。
  frontend-implementer / frontend-reviewer が
  React SPA でのルーティング実装・レビューをするときに参照する。
---

# TanStack Router — ベストプラクティス

> 情報収集日: 2026-08-05 / TanStack Router 最新版（v1系）ベース
> 公式ドキュメント: https://tanstack.com/router/latest

---

## 概要

TypeScript-first のルーティングライブラリ。React（および Solid）向けに設計されており、型安全なルーティングを中心に据えた設計思想を持つ。

**主な特徴:**
- **100% TypeScript 型推論** — ルートパス・パラメータ・検索パラメータがすべて推論される
- **検索パラメータの一等市民化** — JSON の自動シリアライズ・デシリアライズ、型安全性
- **ファイルベース・コードベース両対応** — プロジェクト規模に合わせて選択できる
- **組み込みデータローディング** — `loader` による事前データフェッチ、キャッシュ制御
- **ルートコンテキスト継承** — 認証状態・QueryClient 等を子ルートに型安全に渡せる

**TanStack Query との棲み分け:**

| 役割 | ライブラリ |
|------|-----------|
| URL ルーティング・ナビゲーション | TanStack Router |
| サーバーデータのフェッチ・キャッシュ管理 | TanStack Query |

TanStack Router の `loader` は事前データフェッチ（キャッシュウォームアップ）に使い、実際のキャッシュ管理は TanStack Query に委ねるパターンが推奨される。

---

## インストール・セットアップ

### Vite（推奨）

```bash
npm install @tanstack/react-router
npm install -D @tanstack/router-plugin
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    // router-plugin は react より先に置く
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
})
```

プラグインのデフォルト設定:

```json
{
  "routesDirectory": "./src/routes",
  "generatedRouteTree": "./src/routeTree.gen.ts",
  "routeFileIgnorePrefix": "-",
  "quoteStyle": "single"
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### ルーターの初期化（main.tsx）

```tsx
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

// 型登録（グローバルに型安全なアクセスを有効にする）
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  return <RouterProvider router={router} />
}
```

---

## ルート定義

### createRootRoute

ルート階層の最上位。パスを持たず常にマッチし、コンポーネントは常に描画される。

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div>
      <nav>
        {/* グローバルナビゲーション */}
      </nav>
      <Outlet />
    </div>
  ),
})
```

コンテキスト付き（後述の「認証・ガード」セクション参照）:

```tsx
import { createRootRouteWithContext } from '@tanstack/react-router'

interface MyRouterContext {
  auth: AuthState
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
})
```

### createFileRoute（ファイルベース）

ファイルベースルーティング時に使用する。パス文字列はバンドラープラグインが自動管理する。

```tsx
// src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  component: PostsPage,
})
```

```tsx
// src/routes/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  component: PostDetailPage,
})
```

### createRoute（コードベース）

プログラムでルートを定義する場合に使用する。`getParentRoute` で親を指定し、最後に `addChildren` でツリーを構築する。

```tsx
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

const rootRoute = createRootRoute({
  component: RootComponent,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
})

const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  component: PostsPage,
})

const postRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '$postId',
  component: PostDetailPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  postsRoute.addChildren([postRoute]),
])

const router = createRouter({ routeTree })
```

---

## ファイルベースルーティング（推奨構成）

ファイル構造がそのままルート階層になる。3 つのスタイルを状況に応じて使い分ける。

### フラットルーティング（ドット区切り）

```
src/routes/
├── __root.tsx          # ルートレイアウト
├── index.tsx           # /
├── about.tsx           # /about
├── posts.tsx           # /posts レイアウト
├── posts.index.tsx     # /posts（インデックス）
├── posts.$postId.tsx   # /posts/:postId
└── settings.profile.tsx # /settings/profile
```

### ディレクトリベース

```
src/routes/
├── __root.tsx
├── index.tsx
├── posts/
│   ├── route.tsx        # /posts レイアウト
│   ├── index.tsx        # /posts
│   └── $postId.tsx      # /posts/$postId
└── settings/
    ├── route.tsx        # /settings レイアウト
    └── profile.tsx      # /settings/profile
```

### ファイル命名規則

| ファイル名 | 意味 |
|-----------|------|
| `__root.tsx` | ルートレイアウト |
| `index.tsx` | 該当パスの完全一致 |
| `$paramName.tsx` | 動的パラメータ |
| `_layoutName.tsx` | パスレスレイアウト（URL に影響しない） |
| `$.tsx` | キャッチオール |
| `route.tsx` | ディレクトリベース時のルートファイル |
| `*.tsx`（`-`始まり） | ルート生成対象外（ユーティリティ等） |

---

## Link・useNavigate・useRouter

### Link コンポーネント

```tsx
import { Link } from '@tanstack/react-router'

// 基本
<Link to="/about">About</Link>

// パスパラメータ
<Link to="/posts/$postId" params={{ postId: '123' }}>
  記事詳細
</Link>

// 検索パラメータ
<Link to="/search" search={{ query: 'tanstack', page: 1 }}>
  検索
</Link>

// アクティブスタイル
<Link to="/dashboard" activeProps={{ className: 'font-bold' }}>
  ダッシュボード
</Link>

// exact マッチ（/ でのみアクティブ）
<Link to="/" activeOptions={{ exact: true }}>
  ホーム
</Link>

// プリロード（ホバー時にデータを先読み）
<Link to="/posts/$postId" params={{ postId }} preload="intent">
  記事
</Link>

// 相対ナビゲーション
<Link from={Route.fullPath} to="..">
  親へ戻る
</Link>
```

### useNavigate

コンポーネント内での命令的ナビゲーション。

```tsx
import { useNavigate } from '@tanstack/react-router'

function CreatePostForm() {
  const navigate = useNavigate({ from: '/posts/new' })

  const handleSubmit = async (data: PostInput) => {
    const post = await createPost(data)
    navigate({
      to: '/posts/$postId',
      params: { postId: post.id },
    })
  }
}
```

### Navigate コンポーネント

マウント時に即座にナビゲートする。

```tsx
import { Navigate } from '@tanstack/react-router'

function RedirectToHome() {
  return <Navigate to="/" />
}
```

### router.navigate

ルーターインスタンスを通じたナビゲーション（コンポーネント外からの呼び出し等）。

```tsx
router.navigate({ to: '/posts/$postId', params: { postId: '123' } })
```

---

## パスパラメータ・検索パラメータ（型安全な扱い）

### パスパラメータ

パス文字列に `$` プレフィックスで定義する。

```tsx
// src/routes/posts/$postId.tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    // params.postId は string 型として推論される
    return fetchPost(params.postId)
  },
  component: PostDetailPage,
})

function PostDetailPage() {
  const { postId } = Route.useParams()
  return <div>Post ID: {postId}</div>
}
```

**パスパターン:**

| パターン | 説明 |
|---------|------|
| `$postId` | 単純な動的セグメント |
| `post-{$postId}` | プレフィックス付き（`post-123` にマッチ） |
| `{$fileName}.txt` | サフィックス付き |
| `{-$category}` | オプショナル（undefined も許容） |

### 検索パラメータ

`validateSearch` でスキーマを定義する。Zod との組み合わせが推奨される。

Zod v4 を使う場合、`.default()` / `.catch()` によってスキーマ単体で `validateSearch` の契約（パース失敗時のフォールバック）を満たせるため、`@tanstack/zod-adapter` の `zodValidator` は不要になった。`validateSearch` にスキーマを直接渡せばよい。

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const productSearchSchema = z.object({
  page: z.number().int().min(1).default(1),
  filter: z.string().default(''),
  sort: z.enum(['newest', 'oldest', 'price']).default('newest'),
})

export const Route = createFileRoute('/shop/products')({
  validateSearch: productSearchSchema, // Zod v4 はスキーマをそのまま渡せる
  component: ProductsPage,
})

function ProductsPage() {
  // 型推論される
  const { page, filter, sort } = Route.useSearch()

  return <div>Page: {page}</div>
}
```

> `zodValidator` はZod v3系のスキーマを使う互換ケースでのみ使用する（Zod v3の `.parse()` ベースの挙動に依存するアダプタのため）。Zod v4環境では基本的に不要。

**検索パラメータの更新:**

```tsx
// 関数形式で既存の値を保持しつつ部分更新
<Link search={(prev) => ({ ...prev, page: prev.page + 1 })}>
  次のページ
</Link>
```

**Search Middleware:**

```tsx
import { retainSearchParams, stripSearchParams } from '@tanstack/react-router'

// 特定のパラメータをナビゲーション間で保持する
search: {
  middlewares: [retainSearchParams(['filter'])],
}
```

---

## ローダー（loader）とデータフェッチ

ルートコンポーネントが描画される前に実行されるデータフェッチ関数。

### 基本パターン

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  component: PostsPage,
})

function PostsPage() {
  const posts = Route.useLoaderData()
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}
```

### パスパラメータを使ったフェッチ

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: ({ params }) => fetchPostById(params.postId),
  component: PostDetailPage,
})
```

### 検索パラメータとの連携（loaderDeps）

検索パラメータを loader で使う場合は `loaderDeps` を経由する。不要なキャッシュ無効化を防ぐため、実際に使う値だけを返すこと。

```tsx
export const Route = createFileRoute('/posts')({
  validateSearch: zodValidator(z.object({
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(100).default(20),
  })),
  loaderDeps: ({ search: { offset, limit } }) => ({ offset, limit }),
  loader: ({ deps: { offset, limit } }) => fetchPosts({ offset, limit }),
  component: PostsPage,
})
```

### コンテキストの利用

```tsx
export const Route = createFileRoute('/posts')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(postsQuery),
  component: PostsPage,
})
```

### キャッシュ制御

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  staleTime: 1000 * 60 * 5,    // 5分間は再フェッチしない
  gcTime: 1000 * 60 * 30,      // 30分後にキャッシュを破棄
})
```

### キャンセル対応

```tsx
export const Route = createFileRoute('/posts')({
  loader: ({ abortController }) =>
    fetchPosts({ signal: abortController.signal }),
  component: PostsPage,
})
```

### コンポーネント深部でのデータアクセス

```tsx
import { getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/posts')

function PostList() {
  const posts = routeApi.useLoaderData()
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}
```

---

## ネストルート・レイアウトルート

### ネストルート

親ルートのコンポーネント内に `<Outlet />` を置くことで子ルートを描画する。

```tsx
// src/routes/settings/route.tsx（レイアウト）
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <div className="settings">
      <nav>
        <Link to="/settings/profile">プロフィール</Link>
        <Link to="/settings/notifications">通知</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
```

### パスレスレイアウトルート（アンダースコア接頭辞）

URL に影響せず、複数ルートをロジックやコンポーネントでラップしたい場合に使う。

```
src/routes/
├── _authenticated.tsx        # URL なし、認証チェック用レイアウト
├── _authenticated.dashboard.tsx  # /dashboard（認証必須）
└── _authenticated.profile.tsx    # /profile（認証必須）
```

```tsx
// src/routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <Outlet />,
})
```

---

## 認証・ガード（beforeLoad）

`beforeLoad` はルートのローダーが実行される前に呼ばれる関数。親ルートの `beforeLoad` が先に実行されるため、パスレスレイアウトルートと組み合わせると認証ガードを一元管理できる。

### 基本パターン

```tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href }, // ログイン後に元のページへ戻る
      })
    }
  },
})
```

### コンテキスト経由の認証（推奨）

```tsx
// src/routes/__root.tsx
interface MyRouterContext {
  auth: AuthState
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
})
```

```tsx
// main.tsx
function InnerApp() {
  const auth = useAuth() // 認証フックで状態を取得
  return <RouterProvider router={router} context={{ auth }} />
}
```

```tsx
// src/routes/_authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <Outlet />,
})
```

### エラーとリダイレクトの区別

```tsx
beforeLoad: async ({ location }) => {
  try {
    const user = await verifySession()
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user }
  } catch (error) {
    if (isRedirect(error)) throw error // 意図的なリダイレクトは再スロー
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
},
```

### モーダル認証（リダイレクト不要）

```tsx
export const Route = createFileRoute('/_authenticated')({
  component: () => {
    if (!isAuthenticated()) return <LoginModal />
    return <Outlet />
  },
})
```

---

## エラーハンドリング

### errorComponent

ルートのローダーやコンポーネントでエラーが発生した場合に描画されるコンポーネント。

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  errorComponent: ({ error }) => (
    <div>
      <h1>エラーが発生しました</h1>
      <p>{error.message}</p>
    </div>
  ),
  component: PostsPage,
})
```

### notFoundComponent と notFound()

リソースが存在しない場合に `notFound()` を投げ、`notFoundComponent` で処理する。

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await getPost(params.postId)
    if (!post) throw notFound()
    return { post }
  },
  notFoundComponent: () => {
    const { postId } = Route.useParams()
    return <p>ID: {postId} の記事は見つかりませんでした</p>
  },
  component: PostDetailPage,
})
```

**特定ルートへ not found を委譲:**

```tsx
throw notFound({ routeId: '/' })
// または
throw notFound({ routeId: rootRouteId })
```

**ローダーデータを渡す:**

```tsx
throw notFound({ data: partialLoaderData })
```

### グローバルな not found（ルートに設定）

```tsx
// src/routes/__root.tsx
export const Route = createRootRoute({
  notFoundComponent: () => (
    <div>
      <h1>404 - ページが見つかりません</h1>
      <Link to="/">ホームへ戻る</Link>
    </div>
  ),
})
```

---

## TanStack Query との連携パターン

ルーター層でデータのプリフェッチ（キャッシュウォームアップ）を行い、コンポーネント層で `useSuspenseQuery` を使ってキャッシュ済みデータを読み取るパターンが基本。

### セットアップ

```tsx
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  context: { queryClient }, // コンテキストに QueryClient を注入
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ queryClient }} />
    </QueryClientProvider>
  )
}
```

```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
})
```

### ローダーでプリフェッチ → コンポーネントで読み取り

```tsx
// queryOptions でクエリ定義を一元管理
const postsQuery = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetch('/api/posts').then((r) => r.json()),
})

export const Route = createFileRoute('/posts')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(postsQuery),
  component: PostsPage,
})

function PostsPage() {
  // loader でプリフェッチ済みなので初回からデータがある
  const { data: posts } = useSuspenseQuery(postsQuery)
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}
```

### ストリーミング（await なしプリフェッチ）

ページ遷移を待たせずバックグラウンドでデータを取得する場合は Promise を返却しない。

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: ({ context: { queryClient }, params }) => {
    // await しない → ページ遷移を即座に完了させつつバックグラウンドでフェッチ
    queryClient.prefetchQuery(postQuery(params.postId))
  },
  component: PostDetailPage,
})
```

---

## 型安全性

### Register インターフェース

宣言マージによって `Link`・`useNavigate`・`useParams` 等のユーティリティにルーター型を伝播させる。

```typescript
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

### from パラメータ

コンポーネントが特定ルートに属することを明示し、型推論を絞り込む。

```typescript
// ✅ from を指定して型推論を有効にする
const navigate = useNavigate({ from: Route.fullPath })
const params = useParams({ from: '/posts/$postId' })
```

### strict: false（共有コンポーネント）

複数ルートで使う共有コンポーネントなど、特定ルートを特定できない場合。

```typescript
// strict: false のときは型が緩くなる（必要な場合のみ）
const search = useSearch({ strict: false })
```

### TypeScript パフォーマンス最適化

```typescript
// ✅ from でルート参照を絞る（union 型のチェックを減らす）
<Link from={Route.fullPath} to=".." search={{ page: 0 }} />

// ✅ addChildren にはオブジェクト形式を使う
const routeTree = rootRoute.addChildren({
  indexRoute,
  postsRoute,
})

// ✅ LinkProps には as const satisfies を使う
const props = { to: '/posts/' } as const satisfies LinkProps
```

---

## ベストプラクティス

### ルート定義の集約

```
src/routes/
├── __root.tsx               # ルートレイアウト・コンテキスト定義
├── index.tsx                # /
├── _authenticated/          # 認証必須ルートをまとめる
│   ├── route.tsx            # beforeLoad で認証チェック
│   ├── dashboard.tsx        # /dashboard
│   └── settings.tsx         # /settings
├── posts/
│   ├── route.tsx            # /posts レイアウト
│   ├── index.tsx            # /posts
│   └── $postId.tsx          # /posts/$postId
└── login.tsx                # /login（認証不要）
```

### queryOptions を別ファイルで管理

```typescript
// src/queries/posts.ts
export const postsQuery = queryOptions({
  queryKey: ['posts'],
  queryFn: fetchPosts,
})

export const postQuery = (postId: string) => queryOptions({
  queryKey: ['posts', postId],
  queryFn: () => fetchPostById(postId),
})
```

### Pending Component でローディング UI

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  pendingComponent: () => <Skeleton />,
  component: PostsPage,
})
```

---

## アンチパターン

### loaderDeps に検索パラメータ全体を渡す

```tsx
// ❌ 無関係なパラメータ変更でもキャッシュが無効化される
loaderDeps: ({ search }) => search,

// ✅ loader で実際に使う値だけを返す
loaderDeps: ({ search: { page, filter } }) => ({ page, filter }),
```

### loader でのデータ取得と useQuery の二重フェッチ

```tsx
// ❌ loader でフェッチし、さらにコンポーネントでも独立して useQuery する
loader: () => fetchPosts(),               // loader でフェッチ
const { data } = useQuery(postsQuery)     // 再度フェッチが走る可能性がある

// ✅ loader で ensureQueryData → コンポーネントで useSuspenseQuery（キャッシュから読む）
loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
const { data } = useSuspenseQuery(postsQuery) // キャッシュ済みなので追加フェッチなし
```

### isRedirect チェックなしの catch

```tsx
// ❌ redirect() も catch されてしまう
beforeLoad: async () => {
  try {
    await verifySession()
  } catch {
    throw redirect({ to: '/login' }) // ここに到達しないケースがある
  }
},

// ✅ isRedirect でリダイレクトを再スロー
beforeLoad: async () => {
  try {
    await verifySession()
  } catch (error) {
    if (isRedirect(error)) throw error
    throw redirect({ to: '/login' })
  }
},
```

### コードベースルーティングで addChildren を忘れる

```tsx
// ❌ getParentRoute を指定しただけではルートツリーに含まれない
const postRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '$postId',
})

// ✅ 必ず addChildren でツリーを組み立てる
const routeTree = rootRoute.addChildren([
  postsRoute.addChildren([postRoute]),
])
```

### strict: false の乱用

```tsx
// ❌ 楽をするために strict: false を多用する
const params = useParams({ strict: false }) // 型情報が失われる

// ✅ 特定ルートでは from を使って型推論を保証する
const params = useParams({ from: '/posts/$postId' })
```

---

## レビュー観点（reviewer 向け）

- [ ] `declare module '@tanstack/react-router' { interface Register }` で型登録されているか
- [ ] `validateSearch` に Zod 等のバリデーターが設定されているか（検索パラメータが型安全か）
- [ ] `loaderDeps` は必要な値のみを返しているか（全検索パラメータを渡していないか）
- [ ] `beforeLoad` 内で `isRedirect` チェックをしているか
- [ ] TanStack Query を使う場合、`ensureQueryData` + `useSuspenseQuery` のパターンになっているか
- [ ] コードベースルーティングで `addChildren` でルートツリーを正しく組み立てているか
- [ ] `notFound()` を使ってリソース未検出を適切にハンドリングしているか
- [ ] 認証ガードはパスレスレイアウトルートで一元管理されているか
