---
name: error-handling
description: エラー設計パターン（カスタムエラー階層・Result型・エラーの伝播）。backend-implementer / frontend-implementer / backend-reviewer / frontend-reviewer が参照する。
---

# エラーハンドリングパターン

## エラーの分類

| 種類 | 説明 | 例 |
|---|---|---|
| **Domain Error** | ビジネスルール違反。予測可能・回復可能 | 在庫不足・バリデーションエラー |
| **Application Error** | ユースケースレベルの失敗 | リソースが見つからない・権限不足 |
| **Infrastructure Error** | 外部システムの障害。予測困難 | DB接続失敗・外部API障害 |
| **Unexpected Error** | プログラムのバグ | null参照・型エラー |

---

## カスタムエラー階層

```typescript
// src/domain/shared/domain-error.ts
// 基底クラス
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly message: string,
    readonly statusCode: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    // V8のスタックトレースを正しく設定
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ドメインエラー（400系）
export class DomainError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 400, details);
  }
}

// 認証エラー
export class UnauthorizedError extends AppError {
  constructor(message = '認証が必要です') {
    super('AUTH_REQUIRED', message, 401);
  }
}

// 認可エラー
export class ForbiddenError extends AppError {
  constructor(message = 'この操作を行う権限がありません') {
    super('AUTH_INSUFFICIENT_PERMISSIONS', message, 403);
  }
}

// リソースが見つからない
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource.toUpperCase()}_NOT_FOUND`, `${resource}が見つかりません`, 404);
  }
}

// 競合（重複登録等）
export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}

// バリデーションエラー
export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly fieldErrors: { field: string; message: string }[],
  ) {
    super('VALIDATION_ERROR', message, 400, fieldErrors);
  }
}
```

---

## エラーの伝播パターン

### バックエンド: グローバルエラーハンドラで一元処理

```typescript
// src/infrastructure/http/error-handler.ts
export function errorHandler(err: unknown, c: Context): Response {
  // ログ（本番ではスタックトレースを出力しない）
  if (err instanceof AppError) {
    logger.warn({ code: err.code, message: err.message });
  } else {
    logger.error({ err }, 'Unexpected error');
  }

  // レスポンス
  if (err instanceof ValidationError) {
    return c.json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.fieldErrors,
      },
    }, 400);
  }

  if (err instanceof AppError) {
    return c.json({
      success: false,
      error: { code: err.code, message: err.message },
    }, err.statusCode as StatusCode);
  }

  // 予期しないエラーは詳細を隠す
  return c.json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました' },
  }, 500);
}
```

### ドメインエラーはそのままスロー

```typescript
// ✅ Domain層: ドメインエラーをスロー
class Order {
  confirm(): void {
    if (this.items.length === 0) {
      throw new DomainError('ORDER_EMPTY', '注文に商品が1件もありません');
    }
    if (this.status !== OrderStatus.DRAFT) {
      throw new DomainError('INVALID_ORDER_STATE', '下書き状態の注文のみ確定できます');
    }
    this.status = OrderStatus.CONFIRMED;
  }
}

// ✅ Infrastructure層: インフラエラーをAppErrorに変換
class DrizzleOrderRepository implements OrderRepository {
  async findById(id: OrderId): Promise<Order | null> {
    try {
      const row = await this.db.query.orders.findFirst({ ... });
      return row ? OrderMapper.toDomain(row) : null;
    } catch (err) {
      // DBのエラーをドメインに漏らさない
      logger.error({ err }, 'Database error in OrderRepository.findById');
      throw new AppError('DB_ERROR', 'データベースエラーが発生しました', 500);
    }
  }
}
```

---

## Result型パターン（例外を使わない場合）

失敗が通常フローの一部（例: バリデーション）で例外を使いたくない場合に使う。

```typescript
// Result型の定義
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = <E extends AppError>(error: E): Result<never, E> => ({ ok: false, error });

// 使い方
class OrderService {
  confirmOrder(order: Order): Result<Order, DomainError> {
    if (order.items.length === 0) {
      return err(new DomainError('ORDER_EMPTY', '注文が空です'));
    }
    order.confirm();
    return ok(order);
  }
}

// 呼び出し側
const result = orderService.confirmOrder(order);
if (!result.ok) {
  // エラー処理
  return res.json({ success: false, error: { code: result.error.code } }, 400);
}
// 成功処理
const confirmedOrder = result.value;
```

---

## フロントエンドのエラーハンドリング

### API エラーの型定義

```typescript
// src/lib/api-client.ts
type ApiError = {
  code: string;
  message: string;
  details?: { field: string; message: string }[];
};

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  const body: ApiResponse<T> = await res.json();

  if (!body.success) {
    throw new ApiClientError(body.error);
  }
  return body.data;
}

class ApiClientError extends Error {
  constructor(readonly error: ApiError) {
    super(error.message);
  }
}
```

### React でのエラー処理

```typescript
// TanStack Query と組み合わせる
function useConfirmOrder() {
  return useMutation({
    mutationFn: (orderId: string) => apiFetch(`/api/orders/${orderId}/confirm`, {
      method: 'POST',
    }),
    onError: (err) => {
      if (err instanceof ApiClientError) {
        // エラーコードで分岐
        switch (err.error.code) {
          case 'ORDER_EMPTY':
            toast.error('注文に商品を追加してください');
            break;
          case 'AUTH_REQUIRED':
            router.push('/login');
            break;
          default:
            toast.error(err.error.message);
        }
      }
    },
  });
}

// Error Boundary でキャッチしきれないエラーを処理
export function OrderErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={<ErrorFallback />}
      onError={(err) => logger.error(err)}
    >
      {children}
    </ErrorBoundary>
  );
}
```

---

## やってはいけないこと

```typescript
// ❌ エラーをすべて握りつぶす
try {
  await riskyOperation();
} catch {
  // 何もしない
}

// ❌ エラーメッセージにシステム内部情報を含める
throw new Error(`DB query failed: ${query} with params: ${JSON.stringify(params)}`);

// ❌ catch で unknown を any にキャストする
} catch (err: any) {
  console.log(err.message);  // unknown を直接使う
}

// ✅ 型ガードで絞る
} catch (err: unknown) {
  if (err instanceof AppError) {
    logger.warn(err.code);
  } else {
    logger.error({ err }, 'Unexpected error');
  }
}

// ❌ フロントエンドで生のエラーメッセージをユーザーに見せる
toast.error(err.message);  // "Internal server error: ..." のようなメッセージが見える

// ✅ エラーコードでハンドリングする
toast.error(ERROR_MESSAGES[err.error.code] ?? '予期しないエラーが発生しました');
```
