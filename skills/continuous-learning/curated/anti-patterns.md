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

## Tailwind のカラーをデザイントークンを使わずハードコードする

**問題:** `bg-blue-500` 等を直接プライマリカラーに使うと、shadcn/ui のテーマ・ダークモード切り替えが効かなくなり、全カラー変更時に手作業で全ファイルを修正する必要が生じる。

**発生状況:** デザインシステムを意識せず「とりあえず動く色」で実装するとき。

**悪い例:**
```typescript
// NG: 具体的な色をハードコード
<Button className="bg-blue-500 hover:bg-blue-600 text-white">送信</Button>
<Badge className="bg-green-100 text-green-800">完了</Badge>
```

**良い例:**
```typescript
// OK: デザイントークンを使う（テーマ・ダークモードが自動で機能する）
<Button className="bg-primary hover:bg-primary/90 text-primary-foreground">送信</Button>
<Badge className="bg-success/10 text-success">完了</Badge>
```

**根拠:** shadcn/ui は CSS 変数ベースのテーマ設計。ハードコードカラーはテーマ切り替え・ダークモード対応を壊す。ブランドカラー変更時の修正コストも数倍になる。

---

## Hero → Features（3列グリッド）→ CTA の固定レイアウトを使い回す

**問題:** LP・ダッシュボード問わず同じページ構成を使い続けると、コンテンツの優先順位が無視され「AI生成感」が出る。

**発生状況:** ページ構成を「よくあるランディングページの例」から組み立てるとき。

**悪い例:**
```typescript
// NG: コンテンツに関わらず毎回同じ構成
<HeroSection />
<section className="grid grid-cols-3 gap-6">
  {features.map((f) => <FeatureCard key={f.id} {...f} />)}
</section>
<CtaSection />
```

**良い例:**
```typescript
// OK: コンテンツの性質に合わせて構成を変える
// 例: 比較が主目的なら非対称レイアウト
<section className="grid grid-cols-[3fr_2fr] gap-12 items-start">
  <MainContent />
  <SidePanel />
</section>

// 例: ストーリー性があるなら縦スクロール＋ブレイクポイントで変化をつける
<section className="space-y-24">
  <StepOne className="flex-row" />
  <StepTwo className="flex-row-reverse" />
</section>
```

**根拠:** レイアウトはコンテンツの意味を視覚的に表現する手段。固定テンプレは「コンテンツがレイアウトに従う」逆転を引き起こし、情報の優先順位が伝わらなくなる。

---

## すべてのコンポーネントに `rounded-lg shadow-md` を無差別に適用する

**問題:** 要素の役割に関わらず同じ装飾を全コンポーネントに当てると、視覚的な階層が消え「のっぺり感」が出る。

**発生状況:** スタイルを「とりあえずカードっぽく見せたい」という動機で追加するとき。

**悪い例:**
```typescript
// NG: 役割が異なる要素に同じ装飾
<nav className="rounded-lg shadow-md p-4 bg-white">...</nav>
<aside className="rounded-lg shadow-md p-4 bg-white">...</aside>
<li className="rounded-lg shadow-md p-4 bg-white">...</li>
```

**良い例:**
```typescript
// OK: 役割に合わせた装飾（影・角丸の強度で階層を表現）
<nav className="border-b border-border bg-background">...</nav>  // ナビは境界線のみ
<aside className="rounded-xl border border-border p-4">...</aside>  // サイドバーは控えめ
<li className="rounded-md border border-border/60 p-3 hover:border-border">...</li>  // リストは最小限
```

**根拠:** 影と角丸は「浮き上がり」と「柔らかさ」を表す視覚的な重みを持つ。全要素に同じ強度で当てると奥行きの情報がなくなり、ユーザーが「どこが操作対象か」を判断しにくくなる。

---

## ローディング状態を `<Spinner />` だけで表現する

**問題:** Spinner はコンテンツ領域を空にするため、データ取得完了時にレイアウトシフトが発生する。ユーザーは「何が読み込まれるのか」が分からない。

**発生状況:** 非同期データ取得のローディング UI を実装するとき。

**悪い例:**
```typescript
// NG: Spinner のみ → コンテンツ領域が空になりレイアウトシフト発生
{isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
{!isLoading && <Card data={data} />}
```

**良い例:**
```typescript
// OK: Skeleton でレイアウトを維持（何が来るかの予告にもなる）
{isLoading ? (
  <div className="space-y-3">
    <Skeleton className="h-5 w-48" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
  </div>
) : (
  <Card data={data} />
)}
```

**根拠:** Skeleton はコンテンツが入るスペースを確保し続けるためレイアウトシフトがない。また「何かが来る」という予告になり体感速度が改善する（Progressive Loading）。

---

## 空状態を "No data found." の 1 行で済ませる

**問題:** 空状態にアクションがないと、ユーザーは「壊れているのか、データがないのか、何をすればいいのか」が分からず離脱する。

**発生状況:** リストや検索結果が空のときの表示を実装するとき。

**悪い例:**
```typescript
// NG: 理由もアクションもない
{items.length === 0 && <p className="text-center text-gray-500">No data found.</p>}
```

**良い例:**
```typescript
// OK: コンテキストに応じたアイコン＋説明＋CTA
{items.length === 0 && (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <InboxIcon className="w-10 h-10 text-muted-foreground" />
    <div>
      <p className="font-medium">まだタスクがありません</p>
      <p className="text-sm text-muted-foreground">最初のタスクを追加してみましょう</p>
    </div>
    <Button variant="outline" onClick={onCreate}>タスクを作成</Button>
  </div>
)}
```

**根拠:** 空状態はコンバージョンの好機。CTA を置くことで「次にすること」が明確になり、ユーザーの離脱率が下がる。検索結果の場合は「絞り込みを緩める」等の別アクションが適切。

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

## ファイル保存フックにプロジェクト全体解析ツールを実行させる

**問題:** `tsc --noEmit` や `mypy` はプロジェクト全ファイルを解析するため、ファイル保存ごとに実行すると数秒〜数十秒かかりワークフローを詰まらせる。

**発生状況:** PostToolUse・pre-commit などのファイル保存フックに型チェックを追加したいとき。

**悪い例:**
```javascript
// NG: tsc は全ファイル対象 → 1ファイル保存のたびにプロジェクト全体を解析
if (["ts", "tsx"].includes(ext) && existsSync(tsconfigPath)) {
  const tsc = run("npx", ["tsc", "--noEmit", "--skipLibCheck"]);
  // ...
}
```

**良い例:**
```javascript
// OK: Prettier は単一ファイルを即時処理 → フックに適している
if (isInstalled("prettier")) {
  run("prettier", ["--write", filePath]);
}

// tsc は実装完了時に手動実行 or CI に委ねる
// → package.json の scripts か Makefile に置く
// "typecheck": "tsc --noEmit"
```

**根拠:** tsc にはシングルファイルモードがなく、`--noEmit` でも必ずプロジェクト全体を解析する。`npx` 経由だとさらに起動オーバーヘッドが加わる。フックに入れるべきは「単一ファイルを即時処理できるツール」（Prettier・Ruff・ESLint `--fix`）に限定し、全体解析は CI か実装完了時の手動実行に委ねる。

---
