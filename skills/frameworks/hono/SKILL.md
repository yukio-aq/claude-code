---
name: hono
description: Hono.js のベストプラクティス（2026年版）。backend-implementer / backend-reviewer が参照する。Node.js / Cloudflare Workers / AWS Lambda 対応。
---

# Hono — ベストプラクティス

> 情報収集日: 2026-03-23 / Hono v4.12.x ベース

## Honoの特徴（2026）

- **マルチランタイム対応** — Node.js / Cloudflare Workers / AWS Lambda / Bun / Deno
- **TypeScriptファースト** — 型推論が強力。パスパラメータ・クエリパラメータが型安全
- **超軽量** — コアは約10KB。コールドスタートが速い
- **Express-like構文** — 学習コストが低い

---

## 基本構成

```typescript
// src/app.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

// ミドルウェア（全ルート共通）
app.use('*', logger());
app.use('*', cors({ origin: process.env.FRONTEND_URL }));

export default app;
export type AppType = typeof app;  // RPC用に型をエクスポート
```

---

## ルーティング

### Controllerを作らない（公式ベストプラクティス）

```typescript
// ❌ Rails風のControllerパターン（型推論が壊れる）
const getUser = (c: Context) => {
  const id = c.req.param('id');  // string | undefined（型が弱い）
  return c.json({ id });
};
app.get('/users/:id', getUser);

// ✅ app.route() でファイル分割する
// src/routes/users.ts
import { Hono } from 'hono';

const users = new Hono()
  .get('/', (c) => c.json({ users: [] }))
  .post('/', zValidator('json', CreateUserSchema), async (c) => {
    const body = c.req.valid('json');  // 型が自動推論される
    const user = await createUser(body);
    return c.json({ success: true, data: user }, 201);
  })
  .get('/:id', async (c) => {
    const id = c.req.param('id');  // string として型推論される
    const user = await getUser(id);
    if (!user) return c.notFound();
    return c.json({ success: true, data: user });
  });

export default users;

// src/app.ts
import users from './routes/users';
app.route('/users', users);
```

---

## バリデーション（Zod連携）

```typescript
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).default('user'),
});

app.post(
  '/users',
  zValidator('json', CreateUserSchema, (result, c) => {
    // バリデーション失敗時のカスタムレスポンス
    if (!result.success) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'リクエストの形式が正しくありません',
          details: result.error.flatten().fieldErrors,
        },
      }, 400);
    }
  }),
  async (c) => {
    const body = c.req.valid('json');  // 型が保証される
    const user = await userService.create(body);
    return c.json({ success: true, data: user }, 201);
  }
);
```

---

## ミドルウェア

```typescript
import { createMiddleware } from 'hono/factory';

// 認証ミドルウェア
const authMiddleware = createMiddleware<{
  Variables: { userId: string };  // c.setで設定する値の型
}>(async (c, next) => {
  // v4.12.x: Bearer 認証はケース非依存（'bearer' も受け付ける）
  const token = c.req.header('Authorization')?.replace(/^bearer /i, '');
  if (!token) {
    return c.json({ success: false, error: { code: 'AUTH_REQUIRED' } }, 401);
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return c.json({ success: false, error: { code: 'AUTH_INVALID_TOKEN' } }, 401);
  }

  c.set('userId', payload.sub);
  await next();
});

// ルートに適用
app.use('/api/protected/*', authMiddleware);

// 使用側
app.get('/api/protected/profile', (c) => {
  const userId = c.var.userId;  // 型安全にアクセス
  return c.json({ userId });
});
```

---

## エラーハンドリング

```typescript
// グローバルエラーハンドラ
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({
      success: false,
      error: { code: err.code, message: err.message },
    }, err.statusCode as StatusCode);
  }

  console.error(err);
  return c.json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました' },
  }, 500);
});

// 404ハンドラ
app.notFound((c) => {
  return c.json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'リソースが見つかりません' },
  }, 404);
});
```

---

## エンドツーエンド型安全（Hono RPC）

モノレポ構成でフロントエンドとバックエンドの型を共有できる。

```typescript
// バックエンド: app.ts
const routes = app
  .get('/users', async (c) => {
    const users = await getUsers();
    return c.json({ success: true, data: users });
  })
  .post('/users', zValidator('json', CreateUserSchema), async (c) => {
    const body = c.req.valid('json');
    const user = await createUser(body);
    return c.json({ success: true, data: user }, 201);
  });

export type AppType = typeof routes;

// フロントエンド: api-client.ts
import { hc } from 'hono/client';
import type { AppType } from '../server/app';

const client = hc<AppType>('http://localhost:3000');

// 完全な型推論・補完が効く
const res = await client.users.$post({
  json: { name: 'John', email: 'john@example.com' },
});
const data = await res.json();  // 型が自動推論される

// v4.12.x: $path() でパス文字列のみ取得（キャッシュキー用途など）
const path = client.users.$path();  // '/users'
```

---

## マルチランタイム対応

```typescript
// Node.js
import { serve } from '@hono/node-server';
serve({ fetch: app.fetch, port: 3000 });

// Cloudflare Workers
export default app;

// AWS Lambda
import { handle } from 'hono/aws-lambda';
export const handler = handle(app);

// Bun
export default { port: 3000, fetch: app.fetch };
```

---

## OpenAPI / ドキュメント自動生成

```typescript
import { OpenAPIHono } from '@hono/zod-openapi';

const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/users/{id}',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { content: { 'application/json': { schema: UserSchema } }, description: 'ユーザー取得成功' },
    },
  }),
  async (c) => {
    const { id } = c.req.valid('param');
    const user = await getUser(id);
    return c.json(user);
  }
);

// /doc で Swagger UI が自動生成される
app.doc('/doc', { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' } });
```
