---
description: システム設計パターン集。architect エージェントが設計判断時に参照する。
---

# システム設計パターン集

## レイヤードアーキテクチャ（基本）

```
Presentation Layer   UI / API endpoints
Application Layer    Use cases / Orchestration
Domain Layer         Business logic / Entities
Infrastructure Layer DB / External APIs / Storage
```

依存の方向は常に内側へ（Domain は外を知らない）。

---

## よくある設計判断と推奨パターン

### 状態管理（フロントエンド）

| 状態の種類                 | 推奨            |
| -------------------------- | --------------- |
| サーバーデータのキャッシュ | TanStack Query  |
| グローバルUI状態           | Zustand         |
| フォーム状態               | React Hook Form |
| URL状態                    | nuqs（Next.js） |
| ローカルコンポーネント状態 | useState        |

Reduxは新規プロジェクトでは選ばない。

### API設計

| ユースケース               | 推奨      |
| -------------------------- | --------- |
| CRUD API                   | REST      |
| 複雑なクエリ・BFF          | GraphQL   |
| リアルタイム通信（双方向） | WebSocket |
| サーバー→クライアント通知  | SSE       |
| 内部マイクロサービス間     | gRPC      |

### データベース選定

| 用途                       | 推奨                                  |
| -------------------------- | ------------------------------------- |
| メインDB（リレーショナル） | PostgreSQL                            |
| キャッシュ・セッション     | Redis                                 |
| 全文検索                   | PostgreSQL（PGroonga）/ Elasticsearch |
| ベクトル検索               | pgvector / Qdrant                     |
| ファイルストレージ         | S3互換（Cloudflare R2等）             |

### AIエージェント設計

| ユースケース          | 推奨パターン                          |
| --------------------- | ------------------------------------- |
| 単純なQ&A             | 単一エージェント + RAG                |
| 複数ステップのタスク  | Tool-callingエージェント              |
| 複雑なワークフロー    | マルチエージェント（Mastra workflow） |
| Human確認が必要な処理 | Human-in-the-loop（Mastra suspend）   |
