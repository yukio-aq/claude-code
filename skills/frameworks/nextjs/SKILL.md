---
name: nextjs
description: Next.js 16 App Router のベストプラクティス（2026年版）。frontend-implementer / frontend-reviewer が参照する。
---

# Next.js 16 — App Router ベストプラクティス

> 情報収集日: 2026-08-05 / Next.js 16.3.0 + React 19.2 ベース

## App Router の基本原則

- **コンポーネントはデフォルトでサーバーコンポーネント** — `'use client'` は必要最小限に
- **クライアントコンポーネントは末端に押し込む** — ツリーの上位に置かない
- **データフェッチはサーバーコンポーネントで行う** — クライアントに秘密情報を渡さない
- **Node.js 20.9+ 必須**

```typescript
// ❌ 上位コンポーネントを全クライアント化
'use client';
export default function Layout({ children }) { ... }

// ✅ インタラクティブな部分だけクライアント化
// app/dashboard/page.tsx (Server Component)
export default async function DashboardPage() {
  const data = await fetchDashboardData();
  return (
    <div>
      <h1>ダッシュボード</h1>
      <InteractiveChart data={data} />  {/* ← ここだけ 'use client' */}
    </div>
  );
}
```

---

## ディレクトリ構成

```
src/
├── app/                    # App Router（ルート定義）
│   ├── (marketing)/        # ルートグループ（URLに影響しない）
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   ├── api/                # Route Handlers
│   │   └── users/
│   │       └── route.ts
│   ├── layout.tsx          # Root Layout
│   ├── loading.tsx         # Loading UI
│   ├── error.tsx           # Error UI
│   └── not-found.tsx
│
├── components/
│   ├── ui/                 # shadcn/ui等の汎用コンポーネント
│   └── features/           # 機能特化コンポーネント
│
├── lib/                    # ユーティリティ
├── hooks/                  # カスタムフック（クライアント側のみ）
├── server/                 # サーバー専用コード（DB・外部API等）
└── types/                  # 型定義
```

---

## データフェッチ

```typescript
// サーバーコンポーネント: async/await で直接fetch
export default async function UserPage({ params }: { params: { id: string } }) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, params.id),
  });
  if (!user) notFound();
  return <UserProfile user={user} />;
}
```

---

## キャッシュ制御（v16 新方式）

v16 では `'use cache'` ディレクティブが stable になり、明示的なキャッシュ宣言が標準化。
`fetch()` のデフォルトキャッシュ（`force-cache`）は廃止方向。

> **前提条件:** `'use cache'` を機能させるには `next.config.ts` で `cacheComponents: true` を設定する必要がある。未設定だと Cache Components 機構自体が有効化されず、ディレクティブが期待通りに動作しない。

```typescript
// ✅ v16 推奨: 'use cache' ディレクティブで明示的に制御
'use cache';
import { cacheLife, cacheTag } from 'next/cache';

export async function getUsers() {
  cacheTag('users');         // タグでキャッシュを識別
  cacheLife('hours');        // セマンティックなキャッシュ期間（'seconds' / 'minutes' / 'hours' / 'days' / 'max'）
  return db.query.users.findMany();
}

// ページ全体をキャッシュ
'use cache';
export default async function UsersPage() {
  cacheLife('days');
  const users = await getUsers();
  return <UserList users={users} />;
}
```

```typescript
// キャッシュの無効化
import { revalidateTag } from 'next/cache';

// v16: 第2引数（cacheLife プロファイル）が必須
revalidateTag('users', 'hours');  // ✅
// revalidateTag('users');         // deprecated（将来削除予定）
```

---

## Server Actions

フォーム送信・データ変更はServer Actionsを使う。

**キャッシュ更新は `updateTag` と `revalidateTag` を使い分ける:**
- `updateTag`: Server Action内でのみ使用可能。ユーザー自身の変更を即座にUIへ反映したい場合（read-your-own-writes）に使う
- `revalidateTag`: Server Action以外（Route Handler等）からも呼べる。stale-while-revalidateのため即時反映は保証されない。結果整合性で問題ないコンテンツ（ブログ一覧等）向け

```typescript
// app/actions/user.ts
'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
});

export async function updateUser(formData: FormData) {
  // 1. バリデーション（Zodで必ず行う）
  const parsed = UpdateUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // 2. 認証確認
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  // 3. DB更新
  await db.update(users).set(parsed.data).where(eq(users.id, session.userId));

  // 4. キャッシュ更新（Server Action内で即時反映したいので updateTag）
  updateTag('users');
  return { success: true };
}

// コンポーネントで使用
export function UpdateUserForm({ user }: { user: User }) {
  return (
    <form action={updateUser}>
      <input name="name" defaultValue={user.name} />
      <input name="email" defaultValue={user.email} />
      <button type="submit">更新</button>
    </form>
  );
}
```

---

## Middleware → Proxy（v16 移行）

v16 で `middleware.ts` が廃止され `proxy.ts` に置き換わった。

```typescript
// ❌ v15 以前: middleware.ts
export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL('/login', request.url));
}

// ✅ v16: proxy.ts（ネットワーク境界の明確化）
export default function proxy(request: Request) {
  return Response.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

> **セキュリティ注意:** 2026年5月のセキュリティリリース（16.2.6 / 15.5.18、[Vercel公式changelog](https://vercel.com/changelog/next-js-may-2026-security-release)参照）で、segment-prefetchリクエスト（GHSA-267c-6grr-h53f, GHSA-26hh-7cqf-hhc6）・i18n環境でのdefault-localeパスバイパス（GHSA-36qx-fr4f-26g5）・動的ルートパラメータインジェクション（GHSA-492v-c6pp-mqqv）によって proxy/middleware ベースの認可チェックを回避できる脆弱性が報告された。proxy/middleware だけに認可判定を委ねず、各ルート・Server Action側でも必ずセッション検証を行うこと。

---

## PPR（Partial Pre-Rendering）— v16 stable

静的シェルと動的コンテンツを同一ルートで混在させる。

```typescript
// app/layout.tsx
import { Suspense } from 'react';

export default function Layout({ children }) {
  return (
    <html>
      <body>
        <StaticHeader />   {/* 静的：ビルド時レンダリング */}
        <Suspense fallback={<Skeleton />}>
          {children}        {/* 動的：リクエスト時レンダリング */}
        </Suspense>
        <StaticFooter />   {/* 静的：ビルド時レンダリング */}
      </body>
    </html>
  );
}
```

---

## メタデータ・SEO

```typescript
// 静的メタデータ
export const metadata: Metadata = {
  title: 'ページタイトル',
  description: 'ページの説明',
};

// 動的メタデータ
export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const post = await getPost(params.id);
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      images: [{ url: post.ogImage }],
    },
  };
}
```

---

## パフォーマンス

```typescript
// 画像は必ず next/image を使う
import Image from 'next/image';

<Image
  src="/hero.png"
  alt="ヒーロー画像"
  width={1200}
  height={630}
  priority  // LCPに影響する画像はpriority
  sizes="(max-width: 768px) 100vw, 50vw"
/>

// Dynamic Import でコード分割
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});

// Suspense で段階的ストリーミング
export default function Page() {
  return (
    <div>
      <Header />
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}
```

---

## Turbopack（v16 デフォルト）

```bash
# v16 では next dev でTurbopackが自動有効化
next dev
# 明示的に無効化する場合
next dev --no-turbopack
```

---

## v15 → v16 移行時の注意点

```typescript
// ❌ v15: middleware.ts
// ✅ v16: proxy.ts に改名

// ❌ v15: revalidateTag の単一引数
revalidateTag('posts');
// ✅ v16: 第2引数（cacheLife）が必須
revalidateTag('posts', 'hours');

// ❌ v15: fetch のデフォルトキャッシュ（非推奨化）
const data = await fetch(url, { cache: 'force-cache' });
// ✅ v16: 'use cache' ディレクティブで明示的に
'use cache';
cacheLife('hours');
const data = await fetch(url);

// async params / searchParams は必須化（v15 から継続）
// ✅ v16
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
}
```

---

## よくある間違い

```typescript
// ❌ サーバーコンポーネントでuseState/useEffect
export default function ServerComponent() {
  const [count, setCount] = useState(0);  // エラー
}

// ❌ クライアントコンポーネントでDB直接アクセス
'use client';
const data = await db.query.users.findMany();  // 秘密情報がクライアントに

// ❌ layout.tsx でforce-dynamicを使う（ページ全体が動的になる）
export const dynamic = 'force-dynamic'; // layout.tsxでは使わない

// ✅ 必要なコンポーネントだけ動的にする
// 'use cache' / 'use server' で適切に制御する
```
