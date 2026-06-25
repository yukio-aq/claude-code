---
source: https://github.com/voltagent/awesome-design-md/tree/main/design-md/shopify
last_updated: 2026-06-25
---

# Shopify — デザインシステム参照

> 2トラックシステム：マーケティングは純黒キャンバス × 薄ウェイト NHGD × アウトライン pill、トランザクションはクリームキャンバス × アロエグリーン pill。
> ss03 OpenType が全テキストに適用される character-level signature。pill 形状は両トラックで不変。

---

## カラートークン

```yaml
colors:
  primary: "#000000"          # 主 CTA（filled pill 背景）
  ink: "#000000"              # ライトキャンバス上テキスト
  on-primary: "#ffffff"
  on-dark: "#ffffff"
  canvas-night: "#000000"     # シネマティックマーケティングトラック
  canvas-night-elevated: "#0a0a0a"  # ダークカード・ビデオフレーム
  surface-elevated-dark: "#1e2c31"  # 深緑ティール（ダークカードのサブセット）
  canvas-light: "#ffffff"     # 価格・サインアップ・比較テーブル
  canvas-cream: "#fbfbf5"     # わずかに暖かいオフホワイト（価格ページ背景）
  hairline-light: "#e4e4e7"   # ライトカード 1px ボーダー
  hairline-dark: "#1e2c31"    # ダークカードの 1px ボーダー（まれ）
  aloe-10: "#c1fbd4"          # アロエグリーン — featured CTA・ライトトラックのみ
  pistachio-10: "#d4f9e0"     # ピスタチオ — ワイドバンドセクション（ライトトラックのみ）
  shade-30: "#d4d4d8"         # タグ / チップ背景（ライト）
  shade-40: "#a1a1aa"         # テキスト第3（ライト・ダーク両方）
  shade-50: "#71717a"         # セカンダリテキスト（ライト）
  shade-60: "#52525b"
  shade-70: "#3f3f46"         # primary pill pressed 状態
```

---

## タイポグラフィ

| トークン | サイズ | ウェイト | 行高 | letter-spacing | 用途 |
|---|---|---|---|---|---|
| display-xxl | 96px | 330 | 1.0 | +2.4px | シネマティックヒーロー見出し |
| display-xl | 70px | 330 | 1.0 | 0 | セクションオープナー（ダークトラック） |
| display-lg | 55px | 330 | 1.16 | 0 | 価格ページタイトル |
| display-md | 48px | 330 | 1.14 | 0 | サブセクション見出し（ライトトラック） |
| heading-xl | 28px | 500 | 1.28 | +0.42px | カードタイトル・価格ティア名 |
| heading-lg | 24px | 400 | 1.14 | +0.36px | コンパクトカードタイトル |
| heading-md | 20px | 500 | 1.4 | +0.3px | セクションサブ見出し |
| body-lg | 18px | 550 | 1.56 | 0 | マーケティング本文リード |
| body-md | 16px | 420 | 1.5 | 0 | デフォルト UI 本文・pill ボタンラベル |
| caption | 14px | 500 | 1.49 | +0.28px | ヘルパー・フッター |
| eyebrow-cap | 12px | 400 | 1.2 | +0.72px | 全大文字 eyebrow ラベル |

**フォントファミリー:**
- **Neue Haas Grotesk Display** weight 330–500 — すべての display・ヘッドライン（Helvetica Light で代替可）
- **Inter Variable** weight 420–550 — すべての UI 本文・ボタン・フォーム（Google Fonts で公開）

**原則:**
- **display は必ず weight 330** — thinness がブランドアイデンティティ。400 以上は Editorial 感が消える
- **ss03 をグローバルに** — `font-feature-settings: "ss03"` を body 要素に設定（両フォント共通）
- **96px + 2.4px トラッキング** — 薄グリフに空気が必要。70px 以下は tracking 0

---

## ボーダーラジウス・スペーシング

```yaml
rounded:
  xs: 4px
  sm: 5px
  md: 8px     # フォーム入力・ビデオフレーム
  lg: 12px    # 価格カード・フィーチャーカード
  xl: 20px    # ヒーロー写真フレーム（上角のみのケースも）
  pill: 9999px  # すべてのボタン — 形状は不変

spacing:
  xxs: 2px  xs: 4px  sm: 8px  md: 12px
  lg: 16px  xl: 24px  xxl: 32px  huge: 64px
```

> **pill が唯一のボタン形状** — rounded-rect ボタンは存在しない。

---

## 主要コンポーネント

### ボタン

| コンポーネント | 背景 | テキスト | 形状 | トラック |
|---|---|---|---|---|
| button-primary-pill | primary (#000) | on-primary | pill | 両トラック（ライト側） |
| button-outline-on-dark | canvas-night | on-dark + 2px white border | pill | ダーク（シネマ） |
| button-outline-on-light | canvas-light | ink + 1px ink border | pill | ライト |
| button-aloe-pill | aloe-10 (#c1fbd4) | ink | pill | ライト（featured CTA） |

### カード

| コンポーネント | 背景 | 角丸 | 用途 |
|---|---|---|---|
| card-pricing | canvas-light | rounded-lg (12px) | 標準価格ティア |
| card-pricing-featured | aloe-10 | rounded-lg | ハイライト価格ティア |
| card-feature-cinematic | canvas-night-elevated | rounded-lg | ダークトラックのフィーチャーカード |
| card-pistachio-band | pistachio-10 | rounded-lg | ライトトラックのワイドバンド |
| card-photo-frame | canvas-night | rounded-xl (20px) | シネマティック写真コンテナ（padding 0） |

### シグネチャーコンポーネント

**シネマティック写真レイヤー** — フルブリード商人写真がヒーローを占有。テキストは写真の上ではなく、クリーンなネガティブスペースに配置。

**Stacked Tiny Shadows** — ライトトラック価格カードは 4 層の小オフセットシャドウ（各 1–8px Y, 10% black）で柔らかいペーパーハロを作る。

---

## エレベーション

| レベル | 表現 | 用途 |
|---|---|---|
| 0 | フラット | デフォルト |
| 1 | `0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)` | ダークカードの天面ハイライト |
| 2 | `0 0 0 1px rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.3)` | ダークエレベーテッドカード |
| 3 | 4層スタックシャドウ (`0 8px 8px + 4px 4px + 2px 2px + 0 0 0 1px`) | ライトトラック価格カード |
| 4 | `0 25px 50px -12px rgba(0,0,0,0.25)` | モーダル・フローティングパネル |

---

## Do's and Don'ts

### Do
- マーケティングページに `canvas-night`、トランザクションページに `canvas-light`/`canvas-cream` を使う（混在禁止）
- すべてのボタンに `rounded.pill` を使う — 形状は変えない
- display を weight 330 で実装する
- `aloe-10` と `pistachio-10` をライトトラックのみに予約する
- `ss03` を body 要素にグローバル設定する
- フルブリード写真はコンテナから出す（マーケティングトラック）

### Don't
- 第 3 のキャンバスカラー（グレー・ベージュ・ブルー）を追加しない
- ダークカードに重いドロップシャドウを使わない（天面 inset ハイライトのみ）
- display を 48px 未満のヒーローサーフェスに縮小しない
- アロエ/ピスタチオグリーンをテキストカラーに使わない（サーフェスフィルのみ）
- pill 形状を rounded-rect に変更しない

---

## キー特性サマリー

- **2トラック dual-canvas** — ダーク（シネマ）× ライト（コマース）が共存。混在は禁止
- **display 330 thin** — 薄ウェイトの大サイズが「プレミアムコマース」の editorial 声
- **pill ボタン不変** — 両トラックでのシングルボタン語彙
- **アロエグリーン** — ライトトラックの "growth" シグナル。ダークには出現しない
- **ss03 グローバル** — Neue Haas Grotesk / Inter 両フォントで統一のキャラクター形状
- **写真がコンテンツ** — 写真はスプレッド。テキストはクリーンなネガティブスペースに配置
