---
name: mysql
description: >
  MySQL 8.4 (LTS) のベストプラクティス。スキーマ設計・インデックス設計・
  クエリ最適化・トランザクション・EXPLAIN の読み方・よくある落とし穴。
  backend-implementer / backend-reviewer / database-reviewer が参照。
applyTo: "**"
---

# MySQL 8.4 ベストプラクティス

## バージョン・基本設定

- **MySQL 8.4 (LTS)** を使用。デフォルトストレージエンジンは `InnoDB`
- 文字セットは `utf8mb4`、照合順序は `utf8mb4_unicode_ci` に統一する
- `sql_mode` は `STRICT_TRANS_TABLES` を含む厳格モードを使用する

```sql
-- データベース作成時の推奨設定
CREATE DATABASE myapp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

---

## データ型ベストプラクティス

### 数値

| 用途               | 推奨                             | 禁止                                 |
| ------------------ | -------------------------------- | ------------------------------------ |
| 主キー（自動採番） | `BIGINT UNSIGNED AUTO_INCREMENT` | `INT`（上限あり）                    |
| 金額・通貨         | `DECIMAL(19, 4)`                 | `FLOAT` / `DOUBLE`（浮動小数点誤差） |
| ブール値           | `TINYINT(1)` / `BOOLEAN`         | `CHAR(1)`                            |
| 小さな列挙         | `TINYINT UNSIGNED`               | `ENUM`（変更コストが高い）           |

### 文字列

| 用途                 | 推奨                           | 注意                                     |
| -------------------- | ------------------------------ | ---------------------------------------- |
| 固定長（例: コード） | `CHAR(n)`                      | 可変長より高速（固定長の場合のみ）       |
| 可変長テキスト       | `VARCHAR(n)`                   | 最大65,535バイト（utf8mb4は÷4）          |
| 長文テキスト         | `TEXT`                         | インデックス不可（プレフィックスなら可） |
| UUID                 | `CHAR(36)` または `BINARY(16)` | `VARCHAR` より `BINARY(16)` が効率的     |

### 日時

| 用途                   | 推奨                             | 禁止・非推奨                |
| ---------------------- | -------------------------------- | --------------------------- |
| 作成日時・更新日時     | `DATETIME(3)` または `TIMESTAMP` | `VARCHAR`での日時保存       |
| タイムゾーン考慮が必要 | アプリ層でUTC統一 + `DATETIME`   | `TIMESTAMP`は2038年問題あり |

```sql
-- 推奨パターン
CREATE TABLE users (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(255)    NOT NULL,
  amount     DECIMAL(19, 4)  NOT NULL DEFAULT 0,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                             ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## インデックス設計

### インデックスの種類

| 種類                 | 用途                                                      |
| -------------------- | --------------------------------------------------------- |
| B-tree（デフォルト） | PRIMARY / UNIQUE / INDEX / FULLTEXT（ほぼすべてのケース） |
| R-tree               | 空間データ（SPATIAL）                                     |
| Hash                 | MEMORY テーブルのみ（InnoDB では使用不可）                |

### 複合インデックスと左端一致ルール

```sql
-- 複合インデックス (col1, col2, col3) を作成した場合
CREATE INDEX idx_users_status_created ON users(status, created_at);

-- ✅ インデックスが使われる
SELECT * FROM users WHERE status = 'active';
SELECT * FROM users WHERE status = 'active' AND created_at > '2024-01-01';

-- ❌ インデックスが使われない（最初のカラムをスキップ）
SELECT * FROM users WHERE created_at > '2024-01-01';
```

### カバリングインデックス

クエリが必要とするカラムをすべてインデックスに含めると、データ行へのアクセスなしにインデックスだけで結果を返せる（最速）。

```sql
-- email と name を頻繁にSELECTする場合
CREATE INDEX idx_users_email_name ON users(email, name);

-- このクエリはテーブルデータにアクセスせずインデックスのみで完結
SELECT name FROM users WHERE email = 'user@example.com';
-- EXPLAIN の Extra に "Using index" が表示される
```

### インデックス設計ガイドライン

```sql
-- ✅ インデックスが必要な箇所
-- 1. 外部キーカラム
ALTER TABLE posts ADD INDEX idx_posts_user_id (user_id);

-- 2. WHERE句で頻繁に使うカラム（高カーディナリティ推奨）
ALTER TABLE orders ADD INDEX idx_orders_status (status, created_at);

-- 3. ORDER BY / GROUP BY のカラム（ソートコストを削減）
ALTER TABLE products ADD INDEX idx_products_price (price);

-- 4. JOIN のカラム（同じ型・サイズ・文字セットが必須）
-- ❌ CHAR(10) と CHAR(15) の JOIN → インデックス不使用
-- ✅ VARCHAR(15) と VARCHAR(15) の JOIN → インデックス使用

-- ❌ 不要なインデックス（低カーディナリティ・単体では意味なし）
-- CREATE INDEX idx_users_is_deleted ON users(is_deleted); -- 0/1しかとらないカラム
```

---

## クエリ最適化

### SARGABLE（インデックスが使える）条件

```sql
-- ✅ SARGABLE: インデックスが使われる
WHERE email = 'user@example.com'
WHERE created_at >= '2024-01-01'
WHERE status IN ('active', 'pending')
WHERE name LIKE 'prefix%'          -- 前方一致はOK

-- ❌ 非SARGABLE: インデックスが使われない
WHERE YEAR(created_at) = 2024      -- 関数でカラムを変換
WHERE LOWER(email) = 'user@...'   -- 関数でカラムを変換
WHERE name LIKE '%suffix'          -- 後方一致・部分一致
WHERE age + 1 = 30                 -- 演算でカラムを変換
```

### N+1クエリの防止

```sql
-- ❌ N+1: ループ内でクエリを発行
-- アプリ側で for user in users: SELECT * FROM posts WHERE user_id = ?

-- ✅ JOIN で一括取得
SELECT u.id, u.name, p.title
FROM users u
LEFT JOIN posts p ON p.user_id = u.id
WHERE u.id IN (1, 2, 3);

-- ✅ IN句で一括取得
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
```

### その他のベストプラクティス

```sql
-- ❌ SELECT * は避ける（不要カラムの転送・インデックス最適化を妨げる）
SELECT * FROM users;

-- ✅ 必要なカラムだけ取得
SELECT id, name, email FROM users;

-- ❌ OR 条件は複合インデックスを無効化することがある
WHERE status = 'active' OR status = 'pending'

-- ✅ IN 句に書き換え
WHERE status IN ('active', 'pending')

-- ❌ 暗黙の型変換（インデックス不使用）
WHERE user_id = '123'  -- user_id が INT だが文字列を渡している

-- ✅ 正しい型で渡す
WHERE user_id = 123
```

---

## EXPLAIN の読み方

```sql
EXPLAIN SELECT * FROM users WHERE email = 'user@example.com';
```

### `type` カラム（アクセス方式・良い順）

| type     | 意味                                                 | 評価         |
| -------- | ---------------------------------------------------- | ------------ |
| `system` | 1行しかないテーブル                                  | 最速         |
| `const`  | PRIMARY KEY / UNIQUE INDEX の定数検索                | 最速         |
| `eq_ref` | JOIN での PRIMARY KEY / UNIQUE INDEX 一致            | 速い         |
| `ref`    | 非ユニークインデックスの等値検索                     | 良い         |
| `range`  | インデックスの範囲検索（BETWEEN, IN, >, < 等）       | 許容         |
| `index`  | インデックス全体スキャン（カバリングインデックス時） | 要確認       |
| `ALL`    | フルテーブルスキャン                                 | **改善必須** |

### `Extra` カラムの重要値

| Extra             | 意味                                                           | 対応                   |
| ----------------- | -------------------------------------------------------------- | ---------------------- |
| `Using index`     | カバリングインデックスで完結（高速）                           | 理想的                 |
| `Using where`     | WHERE でさらに絞り込み                                         | 正常                   |
| `Using filesort`  | インデックスなしでソート（追加コスト）                         | インデックス追加を検討 |
| `Using temporary` | 一時テーブルを使用（GROUP BY / ORDER BY の非効率な組み合わせ） | 要改善                 |

### チェックポイント

```sql
-- rows × filtered が実際のヒット件数に近いか確認
-- type = ALL かつ rows が大きい → インデックス追加を検討
-- Using filesort / Using temporary が出たら ORDER BY / GROUP BY を見直す

-- EXPLAIN ANALYZE（MySQL 8.0.18+）で実際の実行コストを確認
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';
```

---

## トランザクション / InnoDB

### ACID と autocommit

```sql
-- InnoDB はデフォルトで autocommit = ON（各ステートメントが自動コミット）
-- 複数ステートメントをまとめるときは明示的にトランザクションを開く

START TRANSACTION;
  UPDATE accounts SET balance = balance - 1000 WHERE id = 1;
  UPDATE accounts SET balance = balance + 1000 WHERE id = 2;
COMMIT;

-- エラー時はロールバック
ROLLBACK;
```

### 分離レベル（InnoDB デフォルト: REPEATABLE READ）

| レベル             | 特徴                                                                              | 用途                            |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------- |
| `REPEATABLE READ`  | 同一トランザクション内は最初のスナップショットを使用。ギャップロックあり          | デフォルト・ACID重視            |
| `READ COMMITTED`   | SELECT ごとに新しいスナップショット。ギャップロックなし（ファントム行リスクあり） | 高スループット・レポート系      |
| `READ UNCOMMITTED` | コミットされていない変更を読む（ダーティリード）。本番では使わない                | —                               |
| `SERIALIZABLE`     | SELECT が共有ロックを取得。最も安全だが最も遅い                                   | XA トランザクション等の特殊用途 |

```sql
-- セッション単位で変更
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

### デッドロック対策

```sql
-- ❌ デッドロックが発生しやすいパターン（逆順アクセス）
-- トランザクション A: users → orders の順にロック
-- トランザクション B: orders → users の順にロック

-- ✅ 常に同じ順序でテーブルをロックする
-- 全トランザクションで users → orders の順にアクセス

-- ✅ 楽観的ロック（競合が低頻度の場合）
UPDATE products
SET stock = stock - 1, version = version + 1
WHERE id = :id AND version = :expected_version;
-- 更新件数が0なら競合発生 → リトライ

-- ✅ SELECT ... FOR UPDATE（排他ロックが必要な場合）
START TRANSACTION;
SELECT * FROM products WHERE id = 1 FOR UPDATE;
UPDATE products SET stock = stock - 1 WHERE id = 1;
COMMIT;
```

---

## スキーマ設計パターン

```sql
-- 論理削除（soft delete）
ALTER TABLE users ADD COLUMN deleted_at DATETIME(3) NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- ステータス管理（ENUM ではなく TINYINT + CHECK制約）
ALTER TABLE orders ADD COLUMN status TINYINT NOT NULL DEFAULT 0
  COMMENT '0=pending, 1=active, 2=completed, 3=cancelled';

-- 多対多の中間テーブル
CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, role_id),
  INDEX idx_user_roles_role_id (role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

---

## スロークエリログと計測

```sql
-- スロークエリログの有効化（my.cnf）
-- slow_query_log = ON
-- slow_query_log_file = /var/log/mysql/slow.log
-- long_query_time = 1  -- 1秒以上を記録

-- Performance Schema でトップクエリを確認
SELECT
  DIGEST_TEXT,
  COUNT_STAR,
  AVG_TIMER_WAIT / 1e12 AS avg_sec,
  SUM_ROWS_EXAMINED / COUNT_STAR AS avg_rows_examined
FROM performance_schema.events_statements_summary_by_digest
ORDER BY AVG_TIMER_WAIT DESC
LIMIT 10;

-- ANALYZE TABLE で統計情報を更新（オプティマイザが正しいインデックスを選ぶため）
ANALYZE TABLE users;
```

---

## よくある落とし穴

### 1. 暗黙の型変換でインデックスが無効化される

```sql
-- ❌ VARCHAR カラムに数値を渡す → 全件スキャン
WHERE user_code = 123

-- ✅ 文字列で渡す
WHERE user_code = '123'
```

### 2. 関数・計算でインデックスが無効化される

```sql
-- ❌ インデックス不使用
WHERE DATE(created_at) = '2024-01-01'
WHERE UPPER(email) = 'USER@EXAMPLE.COM'

-- ✅ 関数を使わない形に書き換え
WHERE created_at >= '2024-01-01 00:00:00'
  AND created_at <  '2024-01-02 00:00:00'
WHERE email = LOWER('USER@EXAMPLE.COM')  -- アプリ側で正規化してから保存
```

### 3. JOIN カラムの型・サイズ不一致

```sql
-- ❌ CHAR(10) と CHAR(15) の JOIN → インデックス不使用（型変換が発生）
-- ✅ 結合カラムは同じ型・同じサイズ・同じ文字セットにそろえる
```

### 4. OFFSET の大きいページネーション

```sql
-- ❌ OFFSET 100000 は先頭から100001行スキャンしてから捨てる
SELECT * FROM logs ORDER BY id LIMIT 20 OFFSET 100000;

-- ✅ カーソル方式
SELECT * FROM logs WHERE id > :cursor ORDER BY id LIMIT 20;
```

### 5. ENUM 型の変更コスト

```sql
-- ❌ ENUM は値の追加・変更に ALTER TABLE が必要（テーブルロック）
status ENUM('active', 'inactive')

-- ✅ TINYINT + アプリ側で定数管理、または VARCHAR + CHECK制約
status TINYINT NOT NULL DEFAULT 0
```

### 6. トランザクション長すぎる問題

```sql
-- ❌ 大量バッチ処理を1トランザクションで包むとロックが長時間継続
-- ✅ バッチは1000件ごとにコミット
COMMIT;  -- 1000件ごと
```

---

## レビューチェックリスト

### スキーマ設計

- [ ] `FLOAT` / `DOUBLE` で金額を保存していないか（`DECIMAL` を使う）
- [ ] 文字セットが `utf8mb4` に統一されているか
- [ ] `ENUM` 型を使っていないか（変更コストが高い）
- [ ] 全テーブルに `created_at` / `updated_at` があるか
- [ ] 外部キーカラムにインデックスがあるか

### インデックス

- [ ] `type = ALL` のクエリにインデックスを追加したか（`EXPLAIN` で確認）
- [ ] 複合インデックスで左端一致ルールを守っているか
- [ ] JOIN カラムの型・サイズ・文字セットが一致しているか
- [ ] 不要なインデックスを作っていないか（低カーディナリティ単体カラム）

### クエリ

- [ ] 関数・計算でカラムをラップしていないか（インデックス無効化）
- [ ] 型変換が暗黙に発生していないか
- [ ] N+1 クエリになっていないか
- [ ] `OFFSET` の大きいページネーションをカーソル方式に変えているか
- [ ] `SELECT *` を使っていないか

### トランザクション

- [ ] 複数テーブルへの書き込みがトランザクションに包まれているか
- [ ] テーブルへのアクセス順序が全トランザクションで統一されているか（デッドロック防止）
- [ ] 長いトランザクションを分割しているか（バッチ処理）
