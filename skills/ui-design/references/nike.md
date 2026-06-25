---
source: https://github.com/voltagent/awesome-design-md/tree/main/design-md/nike
last_updated: 2026-06-25
---

# Nike — デザインシステム参照

> 写真ファースト × Futura 大文字 96px × 純黒/白/ソフトグレーのみのアスレティックコマースシステム。
> CTA・フィルター・バッジ・検索バーすべて pill 形状。製品カードはシャドウなし・角丸なし。セール赤が唯一の発色。

---

## カラートークン

```yaml
colors:
  primary: "#111111"          # ブランドの唯一の "カラー" — CTA・スウォッチ・見出しすべて黒
  on-primary: "#ffffff"
  canvas: "#ffffff"           # ページ背景
  soft-cloud: "#f5f5f5"       # 最頻出ノンホワイト — 製品写真ステージ・検索pill・セカンダリ CTA
  ink: "#111111"              # 主テキスト
  charcoal: "#39393b"         # ソフトボディテキスト
  ash: "#4b4b4d"              # disabled ボーダー・低強調 utility
  mute: "#707072"             # カテゴリサブタイトル・フッターリンク
  stone: "#9e9ea0"            # 逆サーフェス上セカンダリ・最低強調
  hairline: "#cacacb"         # 1px フィルター区切り・フッター列間
  hairline-soft: "#e5e5e5"    # スティッキーバー下 inset シャドウ（唯一の "シャドウ"）
  sale: "#d30005"             # セール価格・"% off" — 小売クロムに唯一存在する色
  sale-deep: "#780700"        # セール hover/pressed
  success: "#007d48"          # "在庫あり" インジケーター
  success-bright: "#1eaa52"
  info: "#1151ff"
  # カテゴリアクセント（キャンペーン写真内のみ — クロムには使わない）
  accent-pink: "#ed1aa0"
  accent-teal: "#0a7281"
```

---

## タイポグラフィ

| トークン | サイズ | ウェイト | 行高 | 特記 | 用途 |
|---|---|---|---|---|---|
| display-campaign | 96px | 500 | 0.9 | uppercase | キャンペーンタイル（Futura ND） |
| heading-xl | 32px | 500 | 1.2 | — | ページタイトル（NHGD） |
| heading-lg | 24px | 500 | 1.2 | — | カードグループタイトル |
| heading-md | 16px | 500 | 1.75 | — | セクションラベル |
| body-md | 16px | 400 | 1.5 | — | デフォルト本文 |
| body-strong | 16px | 500 | 1.5 | — | 製品名・価格 |
| button-lg | 24px | 500 | 1.2 | — | ラージ CTA ボタン |
| button-md | 16px | 500 | 1.5 | — | 標準 CTA ボタン |
| button-sm | 14px | 500 | 1.5 | — | スモール CTA・フィルターチップ |
| caption-md | 14px | 500 | 1.5 | — | カード補足・メタ |
| caption-sm | 12px | 500 | 1.5 | — | プロモバッジ |

**フォントファミリー:**
- **Nike Futura ND** — display-campaign（キャンペーンタイルの uppercase 96px のみ）
- **Helvetica Now Display Medium** — heading 系（weight 500）
- **Helvetica Now Text** / **Helvetica Now Text Medium** — body 系

**原則:**
- **Futura は campaign タイルのみ** — heading/body に使わない。Nike の editorial 声と retail クロムを分離する
- **uppercase は display-campaign のみ** — nav・ボタン・フィルターは通常の sentence-case
- **letter-spacing は 0** — 全トークンで tracking を使わない（Futura の字形がそれ自体で spacing を持つ）

---

## ボーダーラジウス・スペーシング

```yaml
rounded:
  none: 0px   # 製品カード・campaign-tile — 唯一の非 pill コンテナ
  sm: 18px    # pill バリアント（小）
  md: 24px    # 検索 pill
  lg: 30px    # ラージ pill（ほぼ full に見える）
  full: 9999px  # ボタン・フィルターチップ・バッジ — 支配的な形状

spacing:
  xxs: 2px  xs: 4px  sm: 8px  md: 12px
  lg: 18px  xl: 24px  xxl: 30px  section: 48px
```

> **pill が支配的** — ボタン・検索・フィルター・バッジすべて rounded.full。製品カードのみ rounded.none。

---

## 主要コンポーネント

### ボタン・フィルター

| コンポーネント | 背景 | テキスト | 形状 | 用途 |
|---|---|---|---|---|
| button-primary | ink (#111) | on-primary | rounded.full | 主 CTA（"Add to Bag"） |
| button-secondary | soft-cloud | ink | rounded.full | 副 CTA |
| button-outline-on-image | canvas | ink | rounded.full | 写真上のアウトラインボタン |
| search-pill | soft-cloud | ink | rounded.md | 検索バー |
| filter-chip | canvas | ink | rounded.full + 1px hairline | 非アクティブフィルター |
| filter-chip-active | ink | on-primary | rounded.full | アクティブフィルター |
| button-icon-circular | soft-cloud | ink | rounded.full (40px) | アイコンボタン |

### 製品カード

| コンポーネント | 背景 | 角丸 | 特記 |
|---|---|---|---|
| product-card | canvas | 0px | padding 0 — 写真がカード |
| product-card-image | soft-cloud | 0px | 1:1 スクエア写真プレート |

> **製品カードはシャドウなし・角丸なし** — `soft-cloud` の写真ステージがカード自体。

### シグネチャーコンポーネント

**campaign-tile** — `ink` (#111) 背景、`display-campaign`（Nike Futura ND 96px uppercase）がフルブリード写真に重なる。セクションの editorial climax。

**badge-sale-text** — `sale` (#d30005) のテキストカラーのみ。バッジ背景なし。割引価格 + 取り消し線元値がペア。

**swatch-dot** — 12px の `rounded.full` ドット。カラーバリエーション表示。

---

## エレベーション

Nike は **ドロップシャドウを使わない**（hairline-soft の inset シャドウのみ）。

| レベル | 表現 | 用途 |
|---|---|---|
| 0 | フラット | 全サーフェス |
| hairline | 1px hairline (#cacacb) | フィルター行区切り・フッター列間 |
| inset | `inset 0 -1px 0 hairline-soft` | スティッキーバー・タブストリップ下 |
| キャンバス | soft-cloud 背景 | 製品写真の "ステージ"（物理的深度） |

---

## Do's and Don'ts

### Do
- 写真のみに chromatic energy を持たせる — クロムは黒/白/グレーで完結させる
- すべての CTA・フィルター・バッジに `rounded.full` を使う
- 製品カードに `rounded.none` を使い、1:1 写真を `soft-cloud` に載せる
- セール価格にのみ `sale` (#d30005) を使う（装飾目的不可）
- `display-campaign` は campaign-tile のみ — 通常のヘッドラインに使わない
- section rhythm を 48px に保つ（SaaS の 80px や 96px より密度が高い）

### Don't
- クロム（ナビ・ボタン・フィルター）にアクセントカラーを使わない
- 製品カードにシャドウを追加しない
- ボタンに sharp corner（0px）を使わない（pill のみ）
- `display-campaign` の uppercase + Futura を heading に流用しない
- `sale` (#d30005) を CTA 背景や装飾色として使わない

---

## キー特性サマリー

- **写真がコンテンツ** — クロムを最小化して campaign 写真 + 製品写真が editorial を担う
- **純黒/白/グレーのみ** — ink・canvas・soft-cloud の 3 色がクロム面積の 95%
- **pill everywhere** — ボタン・検索・フィルター・バッジすべて rounded.full
- **Futura は campaign-tile 限定** — retail chrome と editorial voice を明確に分離
- **sale 赤が唯一の発色** — #d30005 は価格信号のみ。装飾用途は絶対NG
- **セクション 48px** — アパレルコマースの高密度。SaaS より小さいリズム
