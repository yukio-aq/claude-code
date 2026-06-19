---
name: ui-design
description: リッチなUI実装のためのデザイン品質ルール。"AIらしい"テンプレデザインを避け、プロダクショングレードのUIを生成するための原則・アンチパターン・チェックリスト。frontend-implementer / ui-designer / frontend-reviewer が参照する。
when_to_use:
  - UIコンポーネントを設計・実装するとき
  - デザインレビュー・UIの方向性を決めるとき
  - "それっぽいAI生成デザイン"を避けたいとき
not_for:
  - バックエンドのみのタスク
  - ユニットテスト（testing-patternsを使う）
  - データ可視化・チャート設計（observabilityを参照）
last_updated: 2026-04-16
---

# UI デザイン品質スタンダード

> 参考基準: Linear, Vercel, Stripe, Radix UI
> 情報収集日: 2026-04-16

---

## 1. "AIテル" アンチパターン ブラックリスト

以下のパターンが出たら**即座に別の選択肢を探す**。これらはLLMが統計的に選びやすい"平均的な答え"であり、デザインの個性を殺す。

### 配色
```
❌ primary: blue-500 (#3B82F6) をそのまま使う
❌ Hero に青→紫グラデーション (from-blue-500 to-purple-600)
❌ 全ページの accent が同じ1色しかない
❌ bg-gray-100 を背景に bg-white カードを並べる
```

### レイアウト
```
❌ Hero → Features(3列アイコンカード) → CTA の固定構成
❌ 全要素を text-center + mx-auto でセンタリング
❌ 何でも rounded-lg shadow-md を付ける
❌ セクションに py-20 px-4 mx-auto max-w-7xl を機械的に繰り返す
```

### コンポーネント
```
❌ ボタンを全部 rounded-full (pill型)
❌ glassmorphism (bg-white/10 backdrop-blur-md) を多用
❌ すべてのフィードバックを toast で返す
❌ アイコン+テキストのリストをナビゲーションに使うだけ
❌ 空状態が "No data found." の1行テキストのみ
❌ ローディングが spinner のみ（skeleton なし）
```

### タイポグラフィ
```
❌ ヒーロー h1 に text-5xl font-bold だけ付けて終わり
❌ すべての見出しが同じ font-weight
❌ 本文が text-gray-600 一辺倒（コントラスト不十分になりがち）
```

---

## 2. カラー設計

### 設計哲学
- **ニュートラルが80%の仕事をする** — アクセントカラーは10%以下に抑える
- カラートークンはセマンティックに命名する（`blue-500` ではなく `primary`）
- ダーク/ライト両対応を前提に CSS Variables で定義する

### 推奨トークン構造（Tailwind + shadcn/ui ベース）

```css
:root {
  /* ベース */
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;

  /* サーフェス（カード・シート） */
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;

  /* インタラクティブ */
  --primary: 240 5.9% 10%;        /* ← ここをプロジェクト固有色に変える */
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --accent: 240 4.8% 95.9%;

  /* フィードバック */
  --destructive: 0 84.2% 60.2%;
  --border: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
}
```

### カラー使用ルール
```typescript
// ❌ Tailwindの生値を直接使う（デザイントークンを壊す）
<div className="bg-blue-500 text-white">

// ✅ セマンティックトークンを使う
<div className="bg-primary text-primary-foreground">

// ✅ 透明度でバリエーションを作る（生値より柔軟）
<p className="text-foreground/60">  {/* muted text */}
<div className="bg-primary/10">     {/* tinted background */}
```

---

## 3. タイポグラフィ

### スケール原則
- **3段階が上限**: Display / Body / Caption の3階層で収める
- h1〜h6 をすべて使い分けるのではなく、意味のある2〜3種類に絞る
- `font-weight` の差で視覚的重みを明確にする（`400` / `500` / `700` の3段階）

### 推奨スケール（Next.js / Tailwind）

```typescript
// ページタイトル（Display）
<h1 className="text-3xl font-semibold tracking-tight text-foreground">

// セクション見出し（Heading）
<h2 className="text-xl font-medium text-foreground">

// 説明・本文（Body）
<p className="text-sm text-muted-foreground leading-relaxed">

// ラベル・補足（Caption）
<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
```

### アンチパターン
```typescript
// ❌ font-bold を乱用（全部重くなる）
<h1 className="text-5xl font-bold">  // ← 多くの場面でやりすぎ
<h2 className="text-3xl font-bold">  // ← font-semibold で十分

// ❌ letter-spacing を考慮しない
<h1 className="text-4xl font-semibold">  // tracking-tight を忘れがち
```

---

## 4. スペーシング哲学

**スペースは情報である** — 余白はコンテンツと同等に設計する。

### ルール
- セクション間: `gap-16` 〜 `gap-24`（関係の"遠さ"を表現）
- コンポーネント内要素間: `gap-2` 〜 `gap-4`（関係の"近さ"を表現）
- ページ余白: `px-4 sm:px-6 lg:px-8`（レスポンシブに変化させる）
- カード内パディング: `p-4` 〜 `p-6`（コンテンツ密度に合わせる）

```typescript
// ❌ 機械的に py-20 を繰り返す
<section className="py-20">
<section className="py-20">

// ✅ セクションの重要度・関係性に応じて変える
<section className="py-16">           {/* 主要コンテンツ */}
<section className="py-8 border-t">   {/* 補足コンテンツ */}
```

---

## 5. コンポーネント状態の設計

**すべての状態を設計する** — happy path だけ実装してはいけない。

| 状態 | 必須実装 |
|---|---|
| Loading | Skeleton（コンテンツ形状を模倣）|
| Empty | イラスト or アイコン + 説明文 + CTA |
| Error | エラー内容 + リカバリアクション |
| Success | 視覚的フィードバック（アニメーション）|
| Disabled | 操作不能であることが明確 |
| Hover / Focus | 視覚的変化（CSS transition 付き）|

```typescript
// ❌ loading状態が spinner 1つ
if (isLoading) return <Spinner />

// ✅ コンテンツ形状を模倣したSkeleton
if (isLoading) return (
  <div className="space-y-3">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
    <Skeleton className="h-4 w-[220px]" />
  </div>
)

// ❌ 空状態が1行テキスト
if (items.length === 0) return <p>No items found.</p>

// ✅ 空状態にアクションを持たせる
if (items.length === 0) return (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <InboxIcon className="h-8 w-8 text-muted-foreground/50" />
    <div>
      <p className="text-sm font-medium text-foreground">まだアイテムがありません</p>
      <p className="text-xs text-muted-foreground mt-1">最初のアイテムを追加しましょう</p>
    </div>
    <Button size="sm" variant="outline" onClick={onAdd}>追加する</Button>
  </div>
)
```

---

## 6. マイクロインタラクション

**動きは意味を持つ** — アニメーションは装飾ではなく、状態変化の説明。

```typescript
// ✅ Tailwind + CSS Variables でトランジションを統一
// globals.css に定義
.transition-base {
  transition-property: color, background-color, border-color, opacity, transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

// ✅ ホバー状態に必ず変化を付ける
<button className="
  bg-primary text-primary-foreground
  hover:bg-primary/90
  active:scale-[0.98]
  transition-all duration-150
">

// ✅ フォーカスリングをカスタマイズ（デフォルトの青いリングを消さない）
<input className="
  focus:outline-none
  focus-visible:ring-2
  focus-visible:ring-ring
  focus-visible:ring-offset-2
">
```

---

## 7. レイアウト設計

### グリッドシステム
```typescript
// ❌ フレックスで全部並べる
<div className="flex gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>

// ✅ グリッドを使い、レスポンシブに対応
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>
```

### 視覚的階層
- **一番重要な要素は1つ** — CTAが3つある画面はデザインされていない
- 視線の流れを意識する: Z型（LP）/ F型（ダッシュボード）
- ボーダーより `bg` の差でグルーピングする（線で区切らない）

```typescript
// ❌ ボーダーで囲って区切る
<div className="border rounded-lg p-4">

// ✅ 背景色の差でグルーピング（より自然）
<div className="bg-muted/50 rounded-lg p-4">
```

---

## 8. shadcn/ui カスタマイズ方針

shadcn/ui は出発点であり、**デフォルト値をそのまま使わない**。

```typescript
// ❌ デフォルトのままのButton
<Button>送信</Button>  // ← プロジェクト個性がゼロ

// ✅ プロジェクト固有のデザイントークンに合わせる
// components/ui/button.tsx を編集して角丸・shadow・サイズ感を調整

// ✅ variant を追加してバリエーションを整理
<Button variant="ghost" size="sm">キャンセル</Button>
<Button variant="destructive">削除</Button>
```

カスタマイズすべき主要パラメータ:
- `border-radius` — プロジェクトの "ムード" を決める（sharp: 0px / soft: 6px / round: 12px）
- `shadow` — ほぼ不要。使うなら `shadow-sm` 止まり
- フォントファミリー — Inter / Geist / Noto Sans JP 等をプロジェクトで固定

---

## 9. デザイン品質チェックリスト

実装後に必ず確認する。

### ビジュアル
- [ ] アンチパターンブラックリストに該当するものがないか
- [ ] カラーはセマンティックトークンを使っているか（`blue-500` 直打ちがないか）
- [ ] タイポグラフィスケールが3段階以内に収まっているか
- [ ] 視覚的に最も重要な要素が明確か（CTA が埋もれていないか）
- [ ] ボーダー・シャドウの多用がないか（フラットな方が多くの場合洗練されている）

### 状態
- [ ] Loading状態: Skeleton を実装しているか
- [ ] Empty状態: 説明文 + CTA があるか
- [ ] Error状態: リカバリアクションがあるか
- [ ] Hover/Focus状態: CSSトランジション付きか

### インタラクション
- [ ] ボタン・リンクに hover / active / focus-visible スタイルがあるか
- [ ] フォームの送信中状態（disabled + loading indicator）が実装されているか
- [ ] アニメーションは `150ms〜300ms` の範囲か（長すぎるとUXが悪化）

### レスポンシブ
- [ ] モバイル（375px）・タブレット（768px）・デスクトップ（1280px）で確認したか
- [ ] タッチターゲットが44px以上か（モバイル）

---

## 10. 参考ベンチマーク

| サービス | 学べること |
|---|---|
| [linear.app](https://linear.app) | ダーク UI の精密さ、情報密度とスペーシングのバランス |
| [vercel.com](https://vercel.com) | タイポグラフィ主導のデザイン |
| [stripe.com](https://stripe.com) | データリッチなUIの整理方法 |
| [rauno.me](https://rauno.me) | マイクロインタラクションの参考 |
| [craft.mds.is](https://craft.mds.is) | コンポーネントの仕上がり品質 |
