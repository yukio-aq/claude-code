# Curated Anti-Patterns

繰り返し発生した問題パターンと回避方法。
instincts/ で確認済みのもののみ記載する。

---

<!--
## アンチパターン追加テンプレート

### アンチパターン名

**問題:** 何が問題か（1〜2文）

**発生状況:** どういう状況・コードで起きるか

**悪い例:**
```typescript
// NG
```

**良い例:**
```typescript
// OK
```

**根拠:** なぜ問題なのか。何度発生したか。

---
-->

## SQLite を本番環境の最初から採用する

**問題:** プロトタイプで SQLite を使い始めると、本番移行時に PostgreSQL への移行コストが発生する。JSONB・高度なインデックス・full-text search など PostgreSQL 固有の機能も使えない。

**発生状況:** 「まず動くものを作りたい」「セットアップが楽だから」という理由で SQLite を選択したとき。

**悪い例:**
```typescript
// NG: 本番運用を見据えたプロジェクトで SQLite を採用
// drizzle.config.ts
export default { dialect: 'sqlite', dbCredentials: { url: './local.db' } }
```

**良い例:**
```typescript
// OK: 最初から PostgreSQL を採用（Drizzle + Docker で初期コストは低い）
// drizzle.config.ts
export default { dialect: 'postgresql', dbCredentials: { url: process.env.DATABASE_URL } }

// docker-compose.yml に postgres サービスを追加するだけで開発環境が揃う
```

**根拠:** 複数セッションで「SQLite は本番移行コストがあるため PostgreSQL を採用」という決定が繰り返し発生。開発初期のセットアップコストは Docker で吸収できる。

---

## ローディング state のリセットを `catch` 節だけで行う

**問題:** `catch` の中だけで `setLoading(false)` すると、正常終了パスで例外が飛んだ場合にローディングが固着する。

**発生状況:** API 呼び出しや非同期処理でローディング UI を管理するとき。

**悪い例:**
```typescript
// NG
const fetch = async () => {
  setLoading(true)
  try {
    const res = await api.get()
    setData(res)
    setLoading(false) // ここで例外が飛ぶと以降が実行されない
  } catch (e) {
    setError(e)
    setLoading(false)
  }
}
```

**良い例:**
```typescript
// OK
const fetch = async () => {
  setLoading(true)
  try {
    const res = await api.get()
    setData(res)
  } catch (e) {
    setError(e)
  } finally {
    setLoading(false) // 成功・失敗どちらでも必ず実行
  }
}
```

**根拠:** 複数プロジェクトで「ローディング固着バグ」として観測。`finally` を使う習慣で完全に防止できる。

---

## React の `key` に動的リストで `index` を無条件に使う

**問題:** 並べ替え・フィルタが発生するリストで `index` を `key` にすると、コンポーネントの同一性が崩れてフォームの値が別アイテムに吸い付くなどのバグが発生する。

**発生状況:** リストレンダリング時に「とりあえず `index` を使えばエラーが消える」と対処したとき。

**悪い例:**
```typescript
// NG: ソート・フィルタ可能なリストで index を使う
users
  .filter((u) => u.active)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((u, i) => <UserRow key={i} user={u} />) // index がずれてバグ
```

**良い例:**
```typescript
// OK: ID を使う
users.map((u) => <UserRow key={u.id} user={u} />)

// OK: 固定長・順序不変の入力フォームは index で安定化
workItems.map((item, i) => <WorkItemInput key={`work-item-${i}`} item={item} />)
```

**根拠:** 「key 方針」として複数セッションで議論・決定が繰り返し発生。ID がある場合は ID、なければコンテンツ文字列や複合キーを使う。index が適切なのは固定長・並べ替えなしの配列に限る。

---
