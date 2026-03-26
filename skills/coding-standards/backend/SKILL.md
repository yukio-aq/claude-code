---
name: backend-coding-standards
description: Node.js/PythonのバックエンドAPIコーディングスタンダード。backend-implementer / backend-reviewer が参照する。
---

# バックエンド コーディングスタンダード（Node.js / Python）

## ディレクトリ構成（Node.js）

```
src/
├── routes/       エンドポイント定義（薄く保つ）
├── services/     ビジネスロジック
├── repositories/ DB操作（SQLを隠蔽）
├── schemas/      Zodスキーマ
├── middleware/   認証・ロギング・エラーハンドリング
└── lib/          ユーティリティ
```

## レイヤーの責務

```
Route      → バリデーション・サービス呼び出し・レスポンス整形のみ
Service    → ビジネスロジック・トランザクション管理
Repository → DB操作のみ
```

## エラーハンドリング

```typescript
// カスタムエラークラスで分類
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource}が見つかりません`, 404);
  }
}

class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}

// グローバルエラーハンドラーで一元処理
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.statusCode,
    );
  }
  return c.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "内部エラーが発生しました" },
    },
    500,
  );
});
```

## バリデーション

```typescript
// スキーマは schemas/ に集約
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(50),
});

// Route でバリデーション
app.post("/users", zValidator("json", CreateUserSchema), async (c) => {
  const body = c.req.valid("json");
  const user = await userService.create(body);
  return c.json({ success: true, data: user }, 201);
});
```

## DB操作

```typescript
// トランザクションが必要な処理は必ず明示する
const result = await db.transaction(async (tx) => {
  const user = await tx.insert(users).values(input).returning();
  await tx.insert(userProfiles).values({ userId: user[0].id });
  return user[0];
});
```
