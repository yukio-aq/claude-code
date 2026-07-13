---
name: database
description: DB設計・マイグレーション・クエリ最適化のベストプラクティス。backend-implementer / backend-reviewer / database-reviewer が参照する。
when_to_use:
  - DBスキーマを設計・変更するとき
  - マイグレーションファイルを作成するとき
  - クエリのパフォーマンス問題・N+1を解決するとき
keywords:
  - データベース
  - スキーマ
  - マイグレーション
  - クエリ
  - SQL
links:
  related: [api-design, error-handling]
not_for:
  - APIエンドポイント設計（api-designを使う）
  - キャッシュ層・インメモリDB（Redis等）の設計
  - フロントエンドの状態管理
last_updated: 2026-03-31
---

# データベーススキル

> 情報収集日: 2026-03-31

## スキーマ設計

### 命名規則

```sql
-- テーブル名: snake_case・複数形
users, posts, user_profiles, refresh_tokens

-- カラム名: snake_case
created_at, updated_at, deleted_at, user_id

-- 主キー: id（UUID推奨）
-- 外部キー: <参照テーブル名の単数形>_id
user_id, post_id, organization_id

-- 中間テーブル: <テーブルA>_<テーブルB>（アルファベット順）
post_tags, user_roles
```

### 必須カラム

```sql
-- すべてのテーブルに含める
id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- 論理削除が必要なテーブルのみ
deleted_at TIMESTAMPTZ
```

### データ型の選択

| 用途 | 推奨型 | 避けるべき型 |
|---|---|---|
| 主キー | `UUID` | `SERIAL`（分散DB非対応） |
| 金額 | `NUMERIC(19, 4)` | `FLOAT`（精度誤差） |
| 日時 | `TIMESTAMPTZ` | `TIMESTAMP`（タイムゾーン欠落） |
| フラグ | `BOOLEAN` | `TINYINT` |
| 可変長テキスト | `TEXT` | `VARCHAR(n)`（上限設定が難しい） |
| 列挙値 | `TEXT` + CHECK制約 | `ENUM`（変更コストが高い） |
| JSON | `JSONB` | `JSON`（インデックス非対応） |

---

## マイグレーション

### 安全なマイグレーションの原則

本番データを失わない・ダウンタイムを発生させないために以下を守る。

#### カラム追加（安全）
```sql
-- NULL許容 または DEFAULT付きで追加する
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
```

#### カラム削除（3ステップ必須）
```sql
-- ❌ 即座に削除しない
ALTER TABLE users DROP COLUMN old_field;

-- ✅ Step 1: アプリコードから参照を削除してデプロイ
-- ✅ Step 2: 1〜2スプリント後、カラムをNULL許容に変更（念のため）
ALTER TABLE users ALTER COLUMN old_field DROP NOT NULL;
-- ✅ Step 3: さらに次のスプリントで削除
ALTER TABLE users DROP COLUMN old_field;
```

#### カラムリネーム（2ステップ必須）
```sql
-- ❌ 即座にリネームしない
ALTER TABLE users RENAME COLUMN name TO full_name;

-- ✅ Step 1: 新カラムを追加し、両方を同期するトリガーを作成
ALTER TABLE users ADD COLUMN full_name TEXT;
-- Step 2: データを移行してアプリコードを更新
-- Step 3: 旧カラムを削除（上記「カラム削除」の手順で）
```

#### インデックス追加（ロックなし）
```sql
-- ❌ 本番でそのまま実行するとテーブルがロックされる
CREATE INDEX idx_users_email ON users(email);

-- ✅ CONCURRENTLY を使う
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

### マイグレーションファイルの規約

```
migrations/
├── 0001_create_users.sql
├── 0002_add_posts_table.sql
├── 0003_add_index_users_email.sql  ← 番号は連番
```

- 1ファイル1変更（ロールバックしやすくする）
- ファイル名は変更内容を表す動詞から始める
- 一度コミットしたマイグレーションファイルは編集しない（新しいファイルで修正）

---

## インデックス戦略

### 作成すべきインデックス

```sql
-- 1. 外部キー（JOIN・ON句で使うカラム）
CREATE INDEX CONCURRENTLY idx_posts_user_id ON posts(user_id);

-- 2. WHERE句で頻繁に使うカラム
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_posts_status ON posts(status);

-- 3. ORDER BY / LIMIT で使うカラム
CREATE INDEX CONCURRENTLY idx_posts_created_at ON posts(created_at DESC);

-- 4. 複合条件（カーディナリティの高いカラムを先に）
CREATE INDEX CONCURRENTLY idx_posts_user_status ON posts(user_id, status);

-- 5. 論理削除がある場合（deleted_at IS NULL を含む部分インデックス）
CREATE INDEX CONCURRENTLY idx_users_active ON users(email)
  WHERE deleted_at IS NULL;
```

### 作成してはいけないインデックス

```sql
-- ❌ カーディナリティが低いカラム単体（boolean, status等）
CREATE INDEX idx_users_is_active ON users(is_active);  -- 2値しかない

-- ❌ 更新頻度が極めて高いカラム（書き込みコストが増大）
-- ❌ すでに複合インデックスの先頭にあるカラム（冗長）
```

---

## クエリパターン

### N+1クエリの防止

```typescript
// ❌ N+1: ユーザーごとにpostsを取得
const users = await db.select().from(users);
for (const user of users) {
  user.posts = await db.select().from(posts).where(eq(posts.userId, user.id));
}

// ✅ JOINで一括取得
const result = await db
  .select()
  .from(users)
  .leftJoin(posts, eq(posts.userId, users.id));

// ✅ または IN句でまとめて取得
const userIds = users.map(u => u.id);
const posts = await db.select().from(posts).where(inArray(posts.userId, userIds));
```

### ページネーション

```typescript
// ❌ OFFSET方式（件数が増えると遅くなる）
const posts = await db.select().from(posts)
  .limit(20).offset(page * 20);

// ✅ カーソル方式（大規模データでも一定速度）
const posts = await db.select().from(posts)
  .where(cursor ? lt(posts.createdAt, cursor) : undefined)
  .orderBy(desc(posts.createdAt))
  .limit(21);  // 21件取得して「次ページあり」を判定

const hasNextPage = posts.length === 21;
const data = posts.slice(0, 20);
const nextCursor = hasNextPage ? data[data.length - 1].createdAt : null;
```

### クエリの確認

```sql
-- 実行計画を確認（Seq Scan が出たらインデックス漏れを疑う）
EXPLAIN ANALYZE
  SELECT * FROM posts WHERE user_id = '...' ORDER BY created_at DESC LIMIT 20;
```

---

## トランザクション

```typescript
// 複数テーブルへの書き込みは必ずトランザクションに包む
const result = await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values(input).returning();
  await tx.insert(userProfiles).values({ userId: user.id });
  await tx.insert(auditLogs).values({ action: 'user.created', userId: user.id });
  return user;
});

// 楽観的ロック（同時更新の競合を検出する）
const updated = await db
  .update(posts)
  .set({ title: newTitle, version: sql`version + 1` })
  .where(and(eq(posts.id, id), eq(posts.version, currentVersion)))
  .returning();

if (updated.length === 0) throw new ConflictError('POST_CONFLICT', '競合が発生しました');
```

---

## チェックリスト

実装・レビュー時に確認する。

- [ ] 主キーは UUID か
- [ ] `created_at` / `updated_at` が全テーブルにあるか
- [ ] 外部キーにインデックスがあるか
- [ ] `EXPLAIN ANALYZE` でクエリ実行計画を確認したか
- [ ] N+1クエリが発生していないか
- [ ] カラム削除・リネームは3ステップで実施しているか
- [ ] インデックス追加は `CONCURRENTLY` を使っているか
- [ ] 複数テーブルへの書き込みはトランザクションに包まれているか
- [ ] 金額は `NUMERIC` を使っているか（`FLOAT` は禁止）
- [ ] 一覧取得にはページネーションがあるか
