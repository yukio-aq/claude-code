---
last_updated: 2026-05-09
confidence: high
review_after: 2026-11-09
---

# UI / デザイン — パターン & アンチパターン

UI コンポーネント・Tailwind・レイアウト・アクセシビリティに関するパターン。
frontend-implementer / ui-designer / frontend-reviewer が参照する。

---

## パターン

### マルチステップフォームのバリデーションはボタン契機で一括チェックしサマリー表示する

**概要:** ステップ送信ボタン押下時に `validateStepN()` で一括チェックし、エラーがあればサマリーバナーをステップ内に表示してステップを戻す。per-field リアルタイムバリデーションより実装がシンプルで UX も一貫する。

**適用条件:** 複数ステップで構成される入力フォーム（ウィザード UI）。

**良い例:**
```typescript
const validateStep0 = (): string[] => {
  const errors: string[] = []
  if (!formData.name) errors.push('名前を入力してください')
  if (!formData.date) errors.push('日付を入力してください')
  return errors
}

const handleNextStep = () => {
  const errors = validateStep0()
  if (errors.length > 0) {
    setValidationErrors(errors) // サマリーバナーに表示
    return
  }
  setStep(1)
}
```

**アンチパターン:**
```typescript
// NG: フィールドごとにリアルタイムでバリデーション → ステップをまたぐ状態管理が複雑になる
const handleNameChange = (v: string) => {
  setName(v)
  setNameError(v ? '' : '名前を入力してください')
}
```

**適用すべきでないケース:** 単一ページフォームでリアルタイムフィードバックが UX 要件の場合。

---

## アンチパターン

### Tailwind のカラーをデザイントークンを使わずハードコードする

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

### Hero → Features（3列グリッド）→ CTA の固定レイアウトを使い回す

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
// 比較が主目的なら非対称レイアウト
<section className="grid grid-cols-[3fr_2fr] gap-12 items-start">
  <MainContent />
  <SidePanel />
</section>

// ストーリー性があるなら縦スクロール＋交互レイアウト
<section className="space-y-24">
  <StepOne className="flex-row" />
  <StepTwo className="flex-row-reverse" />
</section>
```

**根拠:** レイアウトはコンテンツの意味を視覚的に表現する手段。固定テンプレは「コンテンツがレイアウトに従う」逆転を引き起こし、情報の優先順位が伝わらなくなる。

---

### すべてのコンポーネントに `rounded-lg shadow-md` を無差別に適用する

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
<nav className="border-b border-border bg-background">...</nav>        // ナビは境界線のみ
<aside className="rounded-xl border border-border p-4">...</aside>     // サイドバーは控えめ
<li className="rounded-md border border-border/60 p-3 hover:border-border">...</li>  // リストは最小限
```

**根拠:** 影と角丸は「浮き上がり」と「柔らかさ」を表す視覚的な重みを持つ。全要素に同じ強度で当てると奥行きの情報がなくなり、ユーザーが「どこが操作対象か」を判断しにくくなる。

---

### ローディング状態を `<Spinner />` だけで表現する

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
// OK: Skeleton でレイアウトを維持
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

**根拠:** Skeleton はコンテンツが入るスペースを確保し続けるためレイアウトシフトがない。「何かが来る」という予告になり体感速度も改善する（Progressive Loading）。

---

### 空状態を "No data found." の 1 行で済ませる

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

**根拠:** 空状態はコンバージョンの好機。CTA を置くことで「次にすること」が明確になり離脱率が下がる。検索結果の場合は「絞り込みを緩める」等の別アクションが適切。

---

### `window.confirm` で削除確認を実装する

**問題:** `window.confirm` はタブレット・WebView 環境（アプリ内ブラウザ等）でブロックされたり動作しないことがある。削除・破棄などの確認ダイアログに使うと、環境によって確認なしで処理が進む、または一切操作できなくなる。

**発生状況:** 削除・キャンセル等の破壊的操作の確認に `window.confirm` / `window.alert` を使う実装。

**悪い例:**
```typescript
// NG: WebView/タブレットでブロックされ、確認なしで処理が進むことがある
const handleDelete = () => {
  if (window.confirm('本当に削除しますか？')) {
    deleteItem(id)
  }
}
```

**良い例:**
```typescript
// OK: アプリ内の ConfirmDialog コンポーネントに置き換える
const [confirmOpen, setConfirmOpen] = useState(false)

const handleDelete = () => setConfirmOpen(true)

<ConfirmDialog
  open={confirmOpen}
  message="本当に削除しますか？"
  onConfirm={() => { deleteItem(id); setConfirmOpen(false) }}
  onCancel={() => setConfirmOpen(false)}
/>
```

**根拠:** `window.confirm`/`alert` はブラウザネイティブのブロッキングダイアログで、WebView・PWA・一部タブレット環境ではポリシーにより抑制・無視されることがある。破壊的操作の確認は自前のモーダルコンポーネントで実装し、全環境で確実に確認を挟む。

---
