---
name: postgresql
description: >
  PostgreSQL 17/18 のベストプラクティス。スキーマ設計・インデックス設計・
  クエリ最適化・MVCC・トランザクション・EXPLAIN の読み方・よくある落とし穴。
  backend-implementer / backend-reviewer / database-reviewer が参照。
applyTo: "**"
---

# PostgreSQL ベストプラクティス

> 情報収集日: 2026-08-05

## バージョン・基本設定

- **PostgreSQL 17 / 18** を対象。PostgreSQLには公式の「LTS」区分は存在せず、全メジャーバージョンが一律5年サポートされる。18は2025年9月のGAから約1年の運用実績があり本番投入可能な状態のため、**新規プロジェクトでは18を第一選択**とする（サポート期限は2029年11月までと17より長い）。17を既存運用中なら無理に切り替える必要はない
- デフォルト分離レベルは **READ COMMITTED**（MySQL の REPEATABLE READ とは異なる）
- MVCC（多版同時実行制御）により **読み取りは書き込みをブロックしない**

### PostgreSQL 18 の主要新機能

- **非同期I/O（AIO）サブシステム**: シーケンシャルスキャン・ビットマップヒープスキャン・VACUUM等でディスク読み取りが最大3倍高速化
- **skip scan**: 複合B-treeインデックスの先頭カラムを条件に含めなくても一部ケースでインデックスが使用可能に
- **仮想生成カラム**: 生成カラムがデフォルトでストレージを使わず読み取り時に計算されるようになった
- `uuidv7()` 組み込み関数の追加（詳細は後述のUUID主キーの項を参照）
- PostgreSQL 19 は2026年7月時点でBeta 2、GAが近い

---

## データ型ベストプラクティス

### 数値

| 用途           | 推奨                                        | 禁止・非推奨                                   |
| -------------- | ------------------------------------------- | ---------------------------------------------- |
| 主キー（整数） | `BIGINT GENERATED ALWAYS AS IDENTITY`       | `SERIAL`（非標準）、`INT`（上限あり）          |
| 主キー（UUID） | `UUID DEFAULT gen_random_uuid()`            | `VARCHAR(36)` での UUID 保存                   |
| 金額・通貨     | `NUMERIC(19, 4)`                            | `FLOAT` / `DOUBLE PRECISION`（浮動小数点誤差） |
| ブール値       | `BOOLEAN`                                   | `SMALLINT`・`CHAR(1)`                          |
| 列挙値         | `TEXT` + CHECK制約 または PostgreSQL `ENUM` | —                                              |

```sql
-- 推奨: IDENTITY カラム（PostgreSQL 10+、SQL標準準拠）
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY

-- UUID 主キー（分散システム・外部露出に適切）
id UUID DEFAULT gen_random_uuid() PRIMARY KEY

-- UUID 主キー（PostgreSQL 18+、挿入性能重視）
id UUID DEFAULT uuidv7() PRIMARY KEY
```

> `gen_random_uuid()`（v4、完全ランダム）はB-treeインデックスへの挿入位置がランダムになりページ分割・キャッシュ効率悪化を招きやすい。PostgreSQL 18+ で追加された `uuidv7()` はタイムスタンプ順に値が生成されるため、挿入局所性が`BIGINT AUTO INCREMENT`に近くなり大規模テーブルで有利。外部にIDを露出しつつ挿入性能も重視する場合は `uuidv7()` を優先する。

### 文字列

| 用途                       | 推奨         | 注意                                 |
| -------------------------- | ------------ | ------------------------------------ |
| 可変長テキスト（上限あり） | `VARCHAR(n)` | 上限不要なら `TEXT` で十分           |
| 上限なしテキスト           | `TEXT`       | MySQL の `TEXT` と違いインデックス可 |
| 固定長                     | `CHAR(n)`    | 末尾スペース埋めに注意               |

> PostgreSQL では `TEXT` と `VARCHAR` はパフォーマンスがほぼ同じ。上限制約が必要なければ `TEXT` で統一してもよい。

### 日時

| 用途               | 推奨          | 禁止・非推奨                    |
| ------------------ | ------------- | ------------------------------- |
| 作成日時・更新日時 | `TIMESTAMPTZ` | `TIMESTAMP`（タイムゾーンなし） |
| 日付のみ           | `DATE`        | `TIMESTAMPTZ` で代用しない      |
| 時刻のみ           | `TIMETZ`      | —                               |

> `TIMESTAMPTZ` は内部では UTC で保存し、表示時にクライアントの `TimeZone` 設定に合わせて変換する。**アプリ全体で UTC に統一する**のが最善。

### JSON

| 用途                     | 推奨                                    | 非推奨                           |
| ------------------------ | --------------------------------------- | -------------------------------- |
| 検索・インデックスが必要 | `JSONB`（バイナリ形式、インデックス可） | `JSON`（テキスト保存、検索遅い） |
| 入力の忠実な再現が必要   | `JSON`                                  | —                                |

```sql
-- JSONB にインデックスを作成
CREATE INDEX idx_users_metadata ON users USING GIN (metadata);
-- → @>, ?, ?|, ?& 演算子での検索が高速になる
```

### その他

```sql
-- 金額
price NUMERIC(19, 4) NOT NULL DEFAULT 0

-- 論理削除
deleted_at TIMESTAMPTZ

-- 必須タイムスタンプ
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

---

## インデックス設計

### インデックスの種類

| 種類                     | 用途                                           | 選択タイミング                             |
| ------------------------ | ---------------------------------------------- | ------------------------------------------ |
| **B-tree**（デフォルト） | 等値・範囲・LIKE前方一致・ORDER BY             | ほぼすべてのケース                         |
| **Hash**                 | 等値検索のみ（`=`）                            | B-tree より高速な等値検索が必要な場合      |
| **GIN**                  | 配列・JSONB・全文検索                          | `@>`, `?`, `@@` 演算子を使う場合           |
| **GiST**                 | 幾何データ・近傍検索                           | PostGIS・地理データ                        |
| **BRIN**                 | 物理順序と相関が高いカラム（タイムスタンプ等） | 超大テーブルで INSERT 順序と一致するカラム |

```sql
-- デフォルト（B-tree）
CREATE INDEX idx_users_email ON users (email);

-- GIN（JSONB 検索）
CREATE INDEX idx_events_payload ON events USING GIN (payload);

-- BRIN（ログテーブル等の created_at）
CREATE INDEX idx_logs_created_at ON logs USING BRIN (created_at);
```

### CONCURRENTLY — 本番に必須

```sql
-- ❌ テーブル全体に AccessShareLock をかける（書き込みブロック）
CREATE INDEX idx_users_email ON users (email);

-- ✅ 本番環境では必ず CONCURRENTLY を使う（ロックなし）
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- 削除も同様
DROP INDEX CONCURRENTLY idx_users_email;
```

> `CONCURRENTLY` を使うと同じトランザクション内では実行できない。マイグレーションスクリプトでは `BEGIN` / `COMMIT` の外で実行する。

### 部分インデックス（Partial Index）

条件に一致する行のみインデックスに含める。サイズが小さく高速。

```sql
-- 論理削除テーブル: 未削除レコードのみインデックス
CREATE INDEX idx_users_email_active ON users (email)
  WHERE deleted_at IS NULL;

-- 未処理ジョブのみ（少数の行に絞れる）
CREATE INDEX idx_jobs_pending ON jobs (created_at)
  WHERE status = 'pending';

-- 条件付き UNIQUE 制約（成功レコードのみユニーク）
CREATE UNIQUE INDEX idx_tests_success ON tests (subject, target)
  WHERE success = true;
```

### 式インデックス（Expression Index）

関数適用後の値にインデックスを作成する。

```sql
-- LOWER() 検索を高速化
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

-- このクエリでインデックスが使われる
WHERE LOWER(email) = 'user@example.com'

-- JSON フィールドの抽出値
CREATE INDEX idx_users_role ON users ((metadata->>'role'));
```

### カバリングインデックス（INCLUDE）

データ行アクセスなしにインデックスのみで結果を返す（Index Only Scan）。

```sql
-- SELECT name FROM users WHERE email = ? がインデックスのみで完結
CREATE INDEX idx_users_email_incl_name ON users (email) INCLUDE (name);
```

### 複合インデックスの設計

```sql
-- 複合インデックスは左端一致ルールが適用される
CREATE INDEX idx_orders_user_status ON orders (user_id, status, created_at);

-- ✅ インデックスが使われる
WHERE user_id = 1
WHERE user_id = 1 AND status = 'active'
WHERE user_id = 1 AND status = 'active' AND created_at > '2024-01-01'

-- ❌ インデックスが使われない（最初のカラムを省略）
WHERE status = 'active'
WHERE created_at > '2024-01-01'
```

---

## クエリ最適化

### SARGABLE 条件（インデックスが使える）

```sql
-- ✅ インデックスが使われる
WHERE email = 'user@example.com'
WHERE created_at >= '2024-01-01'
WHERE status IN ('active', 'pending')
WHERE name LIKE 'prefix%'            -- 前方一致はOK

-- ❌ 非SARGABLE: 関数でカラムを変換するとインデックス不使用
WHERE LOWER(email) = 'user@example.com'  -- 式インデックスがなければNG
WHERE DATE(created_at) = '2024-01-01'   -- TIMESTAMPTZ に関数適用
WHERE name LIKE '%suffix'               -- 後方一致・前方一致でないLIKE
```

### N+1 クエリの防止

```sql
-- ❌ N+1: ループ内でクエリを発行
-- アプリ側で for user in users: SELECT * FROM posts WHERE user_id = ?

-- ✅ JOIN で一括取得
SELECT u.id, u.name, p.title
FROM users u
LEFT JOIN posts p ON p.user_id = u.id
WHERE u.id = ANY(ARRAY[1, 2, 3]);

-- ✅ IN句
SELECT * FROM posts WHERE user_id IN (1, 2, 3);
```

### ページネーション

```sql
-- ❌ OFFSET 方式（大きいページで全件スキャンが発生）
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 100000;

-- ✅ カーソル方式（常に高速）
SELECT * FROM orders
WHERE id > :last_seen_id
ORDER BY id
LIMIT 20;

-- ✅ keyset pagination（複合ソートキーの場合）
SELECT * FROM posts
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

### その他

```sql
-- ❌ SELECT * は避ける（不要カラムの転送・Index Only Scan を妨げる）
SELECT * FROM users;

-- ✅ 必要なカラムだけ取得
SELECT id, name, email FROM users;

-- ✅ 統計情報を更新（AUTOVACUUM が遅れている場合に手動実行）
ANALYZE users;

-- ✅ テーブル統計をリセット
VACUUM ANALYZE users;
```

---

## EXPLAIN の読み方

```sql
-- 基本: コスト見積もりのみ
EXPLAIN SELECT * FROM users WHERE email = 'user@example.com';

-- 詳細: 実際の実行時間・行数も取得（クエリが実際に実行される）
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';

-- バッファ使用量も見る（本番診断時に有用）
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE email = 'user@example.com';
```

### スキャン方式（良い順）

| スキャン方式          | 意味                                           | 評価                         |
| --------------------- | ---------------------------------------------- | ---------------------------- |
| **Index Only Scan**   | インデックスのみで完結（データ行不要）         | 最速                         |
| **Index Scan**        | インデックス → データ行の順アクセス            | 速い                         |
| **Bitmap Index Scan** | 複数インデックスを組み合わせてビットマップ生成 | 中〜速い                     |
| **Seq Scan**          | テーブル全件スキャン                           | **件数が多い場合は改善必須** |

### コストの読み方

```
Seq Scan on users  (cost=0.00..445.00 rows=10000 width=244)
                         ↑         ↑       ↑         ↑
                    起動コスト  総コスト  推定行数  平均行幅(bytes)

(actual time=0.030..1.995 rows=10000 loops=1)
                 ↑         ↑     ↑         ↑
             実際の    実際の  実際の   ループ回数
           起動時間ms 終了時間ms 行数
```

### 注意すべき出力

```
-- ❌ 問題あり
Seq Scan on large_table   → 大テーブルのフルスキャン。インデックス追加を検討
Sort (... Using external merge Buffers)  → ディスクソート。work_mem 増加を検討
Hash (... Batches: 8)     → ハッシュがメモリに収まらずディスクに溢れた

-- ✅ 理想
Index Only Scan           → カバリングインデックスが効いている
Rows Removed by Filter: 0 → インデックスで完全に絞り込めている
```

---

## トランザクション / MVCC

### 基本操作

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 1000 WHERE id = 1;
  UPDATE accounts SET balance = balance + 1000 WHERE id = 2;
COMMIT;

-- エラー時はロールバック
ROLLBACK;

-- セーブポイント
SAVEPOINT sp1;
-- 何らかの処理
ROLLBACK TO SAVEPOINT sp1;
RELEASE SAVEPOINT sp1;
```

### 分離レベル（PostgreSQL デフォルト: READ COMMITTED）

| レベル                           | ダーティリード         | 非反復読み | ファントム     | 用途             |
| -------------------------------- | ---------------------- | ---------- | -------------- | ---------------- |
| **READ COMMITTED**（デフォルト） | 不可                   | 可能       | 可能           | 一般的なOLTP     |
| **REPEATABLE READ**              | 不可                   | 不可       | 不可（PG独自） | レポート・集計   |
| **SERIALIZABLE**                 | 不可                   | 不可       | 不可           | 金融・厳密なACID |
| READ UNCOMMITTED                 | 不可（PG内部でRC動作） | —          | —              | 使わない         |

```sql
-- トランザクション単位で指定
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- 直列化可能（SSI = Serializable Snapshot Isolation）
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- シリアライズ失敗時は SQLSTATE 40001 → アプリ側でリトライ
```

### ロック

```sql
-- 行レベルの排他ロック（UPDATE と同等）
SELECT * FROM products WHERE id = 1 FOR UPDATE;

-- 共有ロック（他の共有ロックとは共存可）
SELECT * FROM products WHERE id = 1 FOR SHARE;

-- SKIP LOCKED（キューの実装に有用）
SELECT * FROM jobs WHERE status = 'pending'
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

### MVCC と VACUUM

- PostgreSQL は更新・削除時に古い行を **「死んだ行」（dead tuple）** として残す
- `AUTOVACUUM` が定期的に回収するが、大量更新後は手動実行を検討
- `VACUUM ANALYZE` でデッドタプルの回収 + 統計情報の更新を同時に行う

```sql
-- テーブル肥大化の確認
SELECT relname, n_dead_tup, n_live_tup, last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;

-- 手動 VACUUM（ロックなし）
VACUUM ANALYZE users;

-- テーブルを再クラスタリング（AccessExclusiveLock 必要 → 本番注意）
VACUUM FULL users;
```

---

## スキーマ設計パターン

```sql
-- 基本テーブルのテンプレート
CREATE TABLE users (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      TEXT            NOT NULL UNIQUE,
  name       TEXT            NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 論理削除対応のインデックス
CREATE INDEX idx_users_email_active ON users (email)
  WHERE deleted_at IS NULL;

-- 多対多の中間テーブル
CREATE TABLE user_roles (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX idx_user_roles_role_id ON user_roles (role_id);

-- JSONB メタデータ
ALTER TABLE users ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
CREATE INDEX idx_users_metadata ON users USING GIN (metadata);
```

---

## パフォーマンス計測

```sql
-- スロークエリを確認（pg_stat_statements が必要）
SELECT query,
       calls,
       mean_exec_time,
       total_exec_time,
       rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- インデックスの使用状況
SELECT schemaname, tablename, indexname,
       idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC  -- 使われていないインデックスを発見
LIMIT 20;

-- テーブルのシーケンシャルスキャン数（頻繁なら要インデックス）
SELECT relname, seq_scan, idx_scan
FROM pg_stat_user_tables
ORDER BY seq_scan DESC
LIMIT 10;
```

---

## よくある落とし穴

### 1. 関数でカラムを変換するとインデックス不使用

```sql
-- ❌ TIMESTAMPTZ に DATE() をかけるとインデックス失効
WHERE DATE(created_at) = '2024-01-01'

-- ✅ 範囲条件に書き換える
WHERE created_at >= '2024-01-01'::date
  AND created_at <  '2024-01-02'::date
```

### 2. LIKE の後方一致はインデックス不使用

```sql
-- ❌ インデックス不使用
WHERE name LIKE '%suffix'

-- ✅ 全文検索が必要なら pg_trgm 拡張 or 全文検索インデックスを使う
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_users_name_trgm ON users USING GIN (name gin_trgm_ops);
WHERE name LIKE '%suffix'  -- ← これが使えるようになる
```

### 3. NULL 比較

```sql
-- ❌ NULL に = は使えない（常に FALSE）
WHERE deleted_at = NULL

-- ✅
WHERE deleted_at IS NULL
WHERE deleted_at IS NOT NULL
```

### 4. OFFSET の大きいページネーション

```sql
-- ❌ 1,000,000 行スキャン後に捨てる
SELECT * FROM posts ORDER BY id LIMIT 20 OFFSET 1000000;

-- ✅ keyset pagination
SELECT * FROM posts WHERE id > :last_id ORDER BY id LIMIT 20;
```

### 5. SERIAL より IDENTITY を使う

```sql
-- ❌ SERIAL は内部的に SEQUENCE を作るが、権限管理が煩雑（レガシー）
id SERIAL PRIMARY KEY

-- ✅ SQL 標準の IDENTITY カラム（PostgreSQL 10+）
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

### 6. 本番でのインデックス追加に CONCURRENTLY を忘れる

```sql
-- ❌ 大テーブルでのマイグレーション中にテーブルロック → ダウンタイム
CREATE INDEX idx_users_email ON users (email);

-- ✅ 必ず CONCURRENTLY をつける
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);
```

### 7. READ COMMITTED での複数 SELECT の一貫性

```sql
-- PostgreSQL のデフォルト READ COMMITTED では、
-- 同一トランザクション内でも SELECT ごとに新しいスナップショットを使う
-- → 2つの SELECT 間にコミットが入ると異なる結果になる

-- ✅ 一貫したスナップショットが必要なら REPEATABLE READ を使う
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) FROM orders; -- スナップショット確定
SELECT SUM(amount) FROM orders; -- 同じスナップショット
COMMIT;
```

---

## レビューチェックリスト

### スキーマ設計

- [ ] `FLOAT` / `DOUBLE PRECISION` で金額を保存していないか（`NUMERIC` を使う）
- [ ] `TIMESTAMP` を使っていないか（`TIMESTAMPTZ` を使う）
- [ ] `SERIAL` を使っていないか（`GENERATED ALWAYS AS IDENTITY` を使う）
- [ ] 全テーブルに `created_at` / `updated_at` があるか
- [ ] JSON 保存に `JSONB` を使っているか（検索・インデックスが必要な場合）
- [ ] 外部キーカラムにインデックスがあるか

### インデックス

- [ ] 大テーブルへの `CREATE INDEX` に `CONCURRENTLY` が付いているか
- [ ] `EXPLAIN ANALYZE` で `Seq Scan` が問題になっていないか
- [ ] 論理削除テーブルに部分インデックス（`WHERE deleted_at IS NULL`）があるか
- [ ] 式インデックスが必要な関数適用検索（`LOWER(email)` 等）に対応しているか

### クエリ

- [ ] 関数でカラムをラップしていないか（インデックス無効化）
- [ ] N+1 クエリになっていないか
- [ ] `OFFSET` の大きいページネーションをカーソル方式に変えているか
- [ ] `SELECT *` を使っていないか

### トランザクション

- [ ] 複数テーブルへの書き込みがトランザクションに包まれているか
- [ ] 分離レベルの選択は適切か（集計・レポートは REPEATABLE READ 推奨）
- [ ] `FOR UPDATE SKIP LOCKED` がキューパターンで使われているか
- [ ] 大量 UPDATE/DELETE 後に `VACUUM ANALYZE` を実行しているか
