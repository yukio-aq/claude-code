---
name: api-design
description: API設計・レスポンス形式・エラーコード・バリデーション・パフォーマンスのベストプラクティス。backend-implementer / backend-reviewer が参照する。
when_to_use:
  - REST / GraphQL APIエンドポイントを設計・実装するとき
  - レスポンス形式・エラーコード・バリデーション戦略を決めるとき
  - APIのパフォーマンス設計（ページネーション・キャッシュ）を検討するとき
keywords:
  - API
  - エンドポイント
  - REST
  - GraphQL
  - バックエンド
links:
  related: [database, error-handling]
not_for:
  - DBスキーマ・マイグレーション設計（databaseを使う）
  - フロントエンドのみのタスク
  - AIエージェントのツール定義（ai-agent-patternsを使う）
last_updated: 2026-04-17
---

# API設計ルール

> 情報収集日: 2026-04-17

## レスポンス形式（統一エンベロープ）

```typescript
// 成功
{ "success": true, "data": { ... } }

// ページネーション付き
{
  "success": true,
  "data": [ ... ],
  "pagination": { "page": 1, "perPage": 20, "total": 100, "totalPages": 5 }
}

// エラー
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "メールアドレスの形式が正しくありません",
    "details": [ ... ]
  }
}
```

## HTTPステータスコード

| コード | 用途 |
|---|---|
| 200 | 成功（取得・更新） |
| 201 | 作成成功 |
| 204 | 成功（削除等・ボディなし） |
| 400 | バリデーションエラー |
| 401 | 未認証 |
| 403 | 認可エラー |
| 404 | リソースが見つからない |
| 409 | 競合（重複登録等） |
| 429 | レート制限超過 |
| 500 | サーバーエラー |

## エンドポイント設計

```
GET    /users           一覧取得
GET    /users/:id       個別取得
POST   /users           作成
PUT    /users/:id       全体更新
PATCH  /users/:id       部分更新
DELETE /users/:id       削除

# ネストは2階層まで
GET    /users/:id/posts     OK
GET    /users/:id/posts/:postId/comments/:commentId  NG → /comments/:id

# アクションはPOSTで表現
POST   /users/:id/activate
POST   /auth/refresh-token
```

## エラーコード命名規則

```
DOMAIN_ERROR_TYPE の形式

AUTH_TOKEN_EXPIRED
AUTH_INSUFFICIENT_PERMISSIONS
USER_NOT_FOUND
USER_EMAIL_ALREADY_EXISTS
VALIDATION_REQUIRED_FIELD
PAYMENT_CARD_DECLINED
RATE_LIMIT_EXCEEDED
```

## バリデーション

- リクエストは必ずZod（TS）またはPydantic（Python）でスキーマ定義
- バリデーションエラーはフィールドごとにメッセージを返す
- スキーマは `/schemas/` または `/validators/` に集約する

## パフォーマンス

- 一覧取得は必ずページネーションを実装する（上限: 100件）
- N+1クエリを防ぐ
- 重い処理はバックグラウンドジョブに切り出す
- レスポンスには必要なフィールドのみ含める
