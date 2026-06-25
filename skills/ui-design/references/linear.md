---
source: https://github.com/voltagent/awesome-design-md/tree/main/design-md/linear.app
last_updated: 2026-06-25
---

# Linear — デザインシステム参照

> ダークキャンバス × ラベンダーアクセント × プロダクトUI主役のマーケティングシステム。
> 最深黒 (#010102) にラベンダーブルー1色のアクセント。サーフェスラダーとヘアラインボーダーで階層を表現する。

---

## カラートークン

```yaml
colors:
  primary: "#5e6ad2"          # ラベンダーブルー — ブランドマーク・CTA・フォーカスリングのみ
  on-primary: "#ffffff"
  primary-hover: "#828fff"
  primary-focus: "#5e69d1"
  ink: "#f7f8f8"              # メイン本文（ライトグレー）
  ink-muted: "#d0d6e0"        # セカンダリテキスト
  ink-subtle: "#8a8f98"       # 第3テキスト（非選択タブ・フッター）
  ink-tertiary: "#62666d"     # 第4テキスト（disabled・脚注）
  canvas: "#010102"           # ページ背景 — ほぼ純黒（わずかな青みがかかる）
  surface-1: "#0f1011"        # カード・プロダクトパネル
  surface-2: "#141516"        # フィーチャー中カード・ホバー状態
  surface-3: "#18191a"        # サブナビ・ドロップダウン
  surface-4: "#191a1b"        # 最深リフトサーフェス
  hairline: "#23252a"         # カード・区切りの1pxボーダー
  hairline-strong: "#34343a"  # フォーカスリング用の強いボーダー
  hairline-tertiary: "#3e3e44"
  semantic-success: "#27a644" # 唯一のセマンティックカラー（ステータスピル用）
```

---

## タイポグラフィ

| トークン | サイズ | ウェイト | 行高 | letter-spacing | 用途 |
|---|---|---|---|---|---|
| display-xl | 80px | 600 | 1.05 | -3.0px | ヒーロー最大見出し |
| display-lg | 56px | 600 | 1.10 | -1.8px | セクション見出し |
| display-md | 40px | 600 | 1.15 | -1.0px | サブセクション見出し |
| headline | 28px | 600 | 1.20 | -0.6px | 価格ティアタイトル・CTAバナー |
| card-title | 22px | 500 | 1.25 | -0.4px | フィーチャーカードタイトル |
| subhead | 20px | 400 | 1.40 | -0.2px | リード本文 |
| body-lg | 18px | 400 | 1.50 | -0.1px | ヒーローサブヘッド |
| body | 16px | 400 | 1.50 | -0.05px | デフォルト本文 |
| body-sm | 14px | 400 | 1.50 | 0 | カード本文・フッター |
| caption | 12px | 400 | 1.40 | 0 | キャプション・メタ情報 |
| button | 14px | 500 | 1.20 | 0 | ボタンラベル |
| eyebrow | 13px | 500 | 1.30 | +0.4px | セクション眉（正のトラッキング） |
| mono | 13px | 400 | 1.50 | 0 | コードスニペット専用 |

**フォントファミリー:** Linear Display / Linear Text（カスタムフォント）→ 代替: **Inter** 500/600/700、**Geist Sans**

**原則:**
- display サイズで aggressive な負のトラッキング（80px で -3.0px ≈ フォントサイズの 4%）
- display 600 → body 400 の同一ファミリー使用（ウェイト変化で階層を表現）
- eyebrow のみ正のトラッキング（+0.4px）— display との対比でカテゴリを示す
- Mono は製品スクリーンショット内のコードコンテキストのみ

---

## ボーダーラジウス・スペーシング

```yaml
rounded:
  xs: 4px    # 小チップ・ステータスバッジ
  sm: 6px    # インラインタグ
  md: 8px    # ボタン・フォーム入力
  lg: 12px   # 価格カード・フィーチャーカード・テスティモニアル
  xl: 16px   # プロダクトスクリーンショットパネル
  xxl: 24px  # 大型 CTAバナー（まれ）
  pill: 9999px  # 価格タブトグル・ステータスピル
  full: 9999px  # アバター円

spacing:
  xxs: 4px   xs: 8px   sm: 12px   md: 16px
  lg: 24px   xl: 32px  xxl: 48px  section: 96px
```

---

## 主要コンポーネント

### ボタン

| コンポーネント | 背景 | テキスト | 形状 | padding |
|---|---|---|---|---|
| button-primary | primary (#5e6ad2) | on-primary | rounded-md (8px) | 8px 14px |
| button-secondary | surface-1 | ink | rounded-md (8px) | 8px 14px + 1px hairline |
| button-tertiary | canvas | ink | rounded-md (8px) | 8px 14px |
| button-inverse | white | black | rounded-md (8px) | 8px 14px |

### カード

| コンポーネント | 背景 | 角丸 | padding |
|---|---|---|---|
| feature-card | surface-1 | rounded-lg (12px) | 24px |
| product-screenshot-card | surface-1 | rounded-xl (16px) | 24px |
| pricing-card | surface-1 | rounded-lg | 24px + 1px hairline |
| pricing-card-featured | surface-2 | rounded-lg | 24px |
| testimonial-card | surface-1 | rounded-lg | 32px |
| cta-banner | surface-1 | rounded-lg | 48px |

### ナビゲーション
- **top-nav**: canvas 背景、高さ 56px、body-sm フォント
- **footer**: canvas 背景、ink-subtle テキスト、caption フォント、64px 32px padding

---

## エレベーション（深度表現）

| レベル | 表現 | 用途 |
|---|---|---|
| 0 (flat) | なし | 本文・ヒーロー・フッター |
| 1 | surface-1 背景 + 1px hairline | デフォルトカード |
| 2 | surface-2 背景 + 1px hairline-strong | フィーチャー中カード・ホバー |
| 3 | surface-3 背景 | サブナビ・ドロップダウン |
| 4 | 2px primary-focus フォーカスリング | フォーカス入力・ボタン |

> **Linear はドロップシャドウを使わない。** 深度はサーフェスラダー + ヘアラインボーダーで表現する。

---

## Do's and Don'ts

### Do
- `canvas` (#010102) を基準サーフェスとして固定する（わずかな青みは意図的）
- `primary` ラベンダーは「ブランドマーク・CTA・フォーカスリング・リンク強調」にのみ使う
- 4段階サーフェスラダーで階層を表現する（段階を飛ばさない）
- display で negative tracking を積極的に適用する（80px → -3.0px）
- ボタンは `rounded-md` 8px の角丸にする（pill 型不可）
- 製品 UI スクリーンショットをセクションの主役に配置する

### Don't
- ライトモードのマーケティングページを作らない
- ラベンダーをセクション背景やカード塗りに使わない
- 第2アクセントカラー（オレンジ・ピンク・グリーン等）を追加しない
- atmospheric グラジエントや spotlight カードを追加しない
- CTA ボタンを pill 型にしない
- `#000000` 純黒をキャンバスに使わない（#010102 を使う）

---

## キー特性サマリー

- **最深ダークキャンバス** — #010102 はこのコレクションで最も暗いサーフェス
- **シングルクロマティックアクセント** — ラベンダーブルー (#5e6ad2) のみ、装飾目的での使用不可
- **サーフェスラダー** — 4段階 (canvas → surface-1 → surface-2 → surface-3) でシャドウ不要の階層
- **製品UI主役** — マーケティングページは製品スクリーンショットのための暗いフレーム
- **タイポグラフィ** — display で極めて負のトラッキング、body では -0.05px まで段階的に緩和
