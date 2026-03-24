---
description: Express.js 5 のベストプラクティス（2026年版）。backend-implementer / backend-reviewer が参照する。
---

# Express.js 5 — ベストプラクティス

> 情報収集日: 2026-03-23 / Express 5.1.0 + TypeScript ベース
> **注:** 新規プロジェクトでは Hono を推奨。Express は既存プロジェクトの保守・大規模チームの標準化用途。
> Node.js 18+ 必須

## Express 5 の主な変更点（v4 → v5）

- **async/await のエラーが自動でエラーハンドラに渡る** — `try/catch` で `next(err)` を呼ぶ必要がなくなった
- **ルートパス構文の変更** — `/:name?` → `{/:name}`、サブ式（`/:foo(\d+)`）は廃止
- **`express.urlencoded` の `extended` デフォルト変更** — `true` → `false`
- **`express.static` の `dotfiles` デフォルト変更** — サーブ → `"ignore"` （`.well-known` が 404 になるので注意）
- **`req.body` のデフォルト変更** — `{}` → `undefined`（ミドルウェアなしでアクセス不可）
- **v5.1.0 で `latest` タグに昇格**（2025年3月）
- 自動移行: `npx @expressjs/codemod v4-to-v5`

---

## 基本構成（TypeScript + ESM）

```typescript
// src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { errorHandler } from './middleware/error-handler.js';

export function buildApp() {
  const app = express();

  // セキュリティ（必須）
  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_URL }));

  // レート制限
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,  // 15分
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // ロギング
  app.use(morgan('combined'));

  // ボディパース
  app.use(express.json({ limit: '10mb' }));
  // v5: extended のデフォルトが false に変更（明示的に指定推奨）
  app.use(express.urlencoded({ extended: false }));

  // ルート
  app.use('/api/users', userRoutes);

  // エラーハンドラ（最後に定義）
  app.use(errorHandler);

  return app;
}

// src/index.ts
import { buildApp } from './app.js';

const app = buildApp();
const port = process.env.PORT ?? 3000;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
```

---

## ルーティング（v5 新パス構文）

```typescript
// src/routes/users.ts
import { Router } from 'express';
import { zValidator } from '../middleware/zod-validator.js';
import { authMiddleware } from '../middleware/auth.js';
import { UserController } from '../controllers/user.controller.js';

const router = Router();
const controller = new UserController();

router.get('/', authMiddleware, controller.list);
router.post('/', zValidator(CreateUserSchema, 'body'), controller.create);

// v5 パス構文: オプションパラメータは {/:name} 形式
// ❌ v4: router.get('/:id?', ...)
// ✅ v5: router.get('{/:id}', ...)
router.get('/:id', authMiddleware, controller.findById);
router.patch('/:id', authMiddleware, zValidator(UpdateUserSchema, 'body'), controller.update);
router.delete('/:id', authMiddleware, controller.delete);

export default router;
```

---

## async/await エラーハンドリング（v5 の恩恵）

```typescript
// ✅ v5: async ルートのエラーが自動でエラーハンドラに渡る
// try/catch + next(err) が不要になった
router.get('/:id', async (req, res) => {
  const user = await userService.findById(req.params.id);
  if (!user) throw new NotFoundError('USER_NOT_FOUND', 'ユーザーが見つかりません');
  res.json({ success: true, data: user });
  // ↑ エラーは自動的に errorHandler に渡る
});

// ❌ v4 での必要だった書き方（v5 では不要）
router.get('/:id', async (req, res, next) => {
  try {
    const user = await userService.findById(req.params.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);  // v5 では不要
  }
});
```

---

## Zodバリデーションミドルウェア

```typescript
// src/middleware/zod-validator.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function zValidator(schema: ZodSchema, target: 'body' | 'query' | 'params') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'リクエストの形式が正しくありません',
          details: result.error.flatten().fieldErrors,
        },
      });
    }

    // バリデーション済みデータを上書き
    req[target] = result.data;
    next();
  };
}
```

---

## エラーハンドラ

```typescript
// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../domain/shared/app-error.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  // 予期しないエラー（スタックトレースは本番で出力しない）
  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました' },
  });
}
```

---

## 認証ミドルウェア

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

// Express の Request に型を拡張
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: '認証が必要です' },
    });
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID_TOKEN', message: 'トークンが無効です' },
    });
  }

  req.userId = payload.sub;
  next();
}
```

---

## セキュリティ設定

```typescript
// 必須ミドルウェア一覧
app.use(helmet());                    // セキュリティヘッダー
app.use(helmet.hsts());               // HTTPS強制
app.use(cors({ origin: whitelist })); // CORS（ワイルドカード禁止）
app.use(rateLimit({ ... }));          // レート制限
app.disable('x-powered-by');         // Express情報の非公開

// .well-known を提供する場合（Apple/Android App Links）
// v5 では dotfiles のデフォルトが 'ignore' に変わったため明示的に設定
app.use(express.static('public', { dotfiles: 'allow' }));
```

---

## パフォーマンス

```typescript
import compression from 'compression';

// Gzip圧縮（帯域幅を最大70%削減）
app.use(compression());

// 重いCPU処理はWorker Threadsに逃がす
import { Worker } from 'worker_threads';
app.post('/process', async (req, res) => {
  const result = await runInWorker('./workers/heavy-task.js', req.body);
  res.json({ success: true, data: result });
});

// PM2でクラスタリング（全CPUコアを使用）
// package.json: "start": "pm2 start dist/index.js -i max"
```

---

## Honoとの使い分け

| | Express | Hono |
|---|---|---|
| 既存プロジェクトの保守 | ✅ | — |
| 大規模チームの標準化 | ✅（エコシステムが成熟） | △ |
| 新規 API サーバー | △ | ✅ |
| Cloudflare Workers / Edge | ❌ | ✅ |
| エンドツーエンド型安全（RPC） | ❌ | ✅ |
| コールドスタート重視 | △ | ✅ |
