---
source: https://github.com/voltagent/awesome-design-md/tree/main/design-md/stripe
last_updated: 2026-06-25
---

# Stripe — デザインシステム参照

> グラジエントメッシュ × 薄ウェイト（300）タイポグラフィ × インジゴ単色 CTA の金融インフラブランド。
> ヒーロー上部 1/3 をパステルグラジエントメッシュが占め、白キャンバスに戻ってフィーチャーを説明する。

---

## カラートークン

```yaml
colors:
  primary: "#533afd"              # シグネチャーインジゴ CTA — ページにつき filled ボタン 1 個
  primary-deep: "#4434d4"         # グラジエント中間点・pressed 代替
  primary-press: "#2e2b8c"        # pressed ステート
  primary-soft: "#665efd"         # プロダクト UI アクセント・チャートハイライト
  primary-bg-subdued-hover: "#b9b9f9"  # ソフトタグ背景
  brand-dark-900: "#1c1e54"       # フィーチャー中価格ティア・ダッシュボードクロム
  ink: "#0d253d"                  # ボディテキスト — ディープネイビー（純黒ではない）
  ink-secondary: "#273951"        # セカンダリテキスト
  ink-mute: "#64748d"             # ヘルパーテキスト・キャプション・テーブルラベル
  on-primary: "#ffffff"
  canvas: "#ffffff"               # ページ背景
  canvas-soft: "#f6f9fc"          # クールオフホワイト（グラジエントヒーロー以下のフィーチャーバンド）
  canvas-cream: "#f5e9d4"         # ウォームクリーム（インジゴ/ホワイト間の彩度的インタールード）
  hairline: "#e3e8ee"             # カード・テーブルの 1px ボーダー
  hairline-input: "#a8c3de"       # フォーム入力の境界線
  ruby: "#ea2261"                 # グラジエントアクセント（ボタン用途不可）
  magenta: "#f96bee"              # グラジエント明るいピンク
```

---

## タイポグラフィ

| トークン | サイズ | ウェイト | 行高 | letter-spacing | 用途 |
|---|---|---|---|---|---|
| display-xxl | 56px | 300 | 1.03 | -1.4px | ヒーロー見出し |
| display-xl | 48px | 300 | 1.15 | -0.96px | セクション冒頭 |
| display-lg | 32px | 300 | 1.1 | -0.64px | カードタイトル・サブセクション |
| display-md | 26px | 300 | 1.12 | -0.26px | コンパクトカードタイトル |
| heading-lg | 22px | 300 | 1.1 | -0.22px | 価格ティア名 |
| heading-md | 20px | 300 | 1.4 | -0.2px | セクションサブ見出し |
| body-lg | 16px | 300 | 1.4 | 0 | マーケティング本文リード |
| body-md | 15px | 300 | 1.4 | 0 | デフォルト UI 本文 |
| body-tabular | 14px | 300 | 1.4 | -0.42px | 金額・数値テーブル（`tnum`） |
| button-md | 16px | 400 | 1.0 | 0 | pill ボタンラベル |
| caption | 13px | 400 | 1.4 | -0.39px | ヘルパー・テーブルラベル |
| micro-cap | 10px | 400 | 1.15 | +0.1px | 全大文字 eyebrow |

**フォントファミリー:** Sohne（weight 300 / 400、ss01 有効）→ 代替: **Inter** weight 300 + `font-feature-settings: "ss01"` + `letter-spacing: -1.4px`

**原則:**
- **細ウェイトがブランド** — display は常に weight 300。400以上でブランドの editorial 感が崩れる
- **数値には tnum** — 金額・取引数・カウントには `font-feature-settings: "tnum"` を必ず適用
- **ss01 をグローバルに** — `body` 要素に `font-feature-settings: "ss01"` を設定

---

## ボーダーラジウス・スペーシング

```yaml
rounded:
  xs: 4px   sm: 6px   md: 8px   lg: 12px   xl: 16px
  pill: 9999px  # すべてのボタン・タグピル

spacing:
  xxs: 2px  xs: 4px  sm: 8px   md: 12px
  lg: 16px  xl: 24px  xxl: 32px  huge: 64px
```

---

## 主要コンポーネント

### ボタン（pill 型）

| コンポーネント | 背景 | テキスト | 形状 | padding |
|---|---|---|---|---|
| button-primary-pill | primary (#533afd) | on-primary | pill | 8px 16px |
| button-secondary | canvas | primary | pill + 1px primary border | 8px 16px |
| button-on-dark | brand-dark-900 | on-primary | pill | 8px 16px |

> **すべてのボタンが pill 型 (9999px)**。rounded-rect への変更は不可。

### カード

| コンポーネント | 背景 | 角丸 | padding | 備考 |
|---|---|---|---|---|
| card-feature-light | canvas | rounded-lg (12px) | 32px | Level 1 シャドウ |
| card-pricing | canvas | rounded-lg | 32px | 1px hairline |
| card-pricing-featured | brand-dark-900 | rounded-lg | 32px | ダークネイビー反転 |
| card-cream-band | canvas-cream | rounded-lg | 32px | ウォームインタールード |
| card-dashboard-mockup | canvas | rounded-lg | 24px | 数値列に tnum |

### シグネチャーコンポーネント

**グラジエントメッシュバックドロップ** — クリーム→シャーベットオレンジ→ラベンダー→インジゴ→ルビーピンクのブレンド。ページ上部 1/3 を占める。CSS グラジエントではなく SVG または背景画像で実装。

**数値タイポグラフィ** — 金額・カウントを含むすべてのセルに `font-feature-settings: "tnum"` を適用。ブランドの「金融インフラ」の静かなシグナル。

---

## エレベーション

| レベル | シャドウ | 用途 |
|---|---|---|
| 0 | なし | デフォルトサーフェス |
| 1 | `rgba(0,55,112,0.08) 0 1px 3px` | カードリフト（白背景上） |
| 2 | `rgba(0,55,112,0.08) 0 8px 24px, 0 2px 6px` | フローティングパネル・ダッシュボードモックアップ |
| 3 | グラジエントメッシュ | ブランド主要深度メディア |

---

## Do's and Don'ts

### Do
- `primary` インジゴはバンドにつき filled ボタン 1 個に限定する
- すべてのマーケティングヒーローにグラジエントメッシュを適用する（素のキャンバスのヒーローはブランド外）
- display は weight 300 + 負のトラッキングで実装する
- 金額・数値セルに `tnum` を必ず使う
- `ss01` をグローバルに body 要素に設定する
- フィーチャー説明には必ずコンポジットプロダクトUIモックアップを添える

### Don't
- display を weight 300 より大きくしない — 400 でブランドの editorial 感が消える
- ドキュメントされたグラジエントストップ以外のアクセントカラーを追加しない
- `primary` インジゴをボディテキストカラーに使わない（CTA・リンク色のみ）
- ボタンのpadding を `8px 16px` より小さくしない
- 金額セルから `tnum` を省略しない
- pill 型ボタンを rounded-rect に変更しない

---

## キー特性サマリー

- **グラジエントメッシュ** — すべてのマーケティングヒーロー上部 1/3 を占める必須要素
- **シングルインジゴ CTA** — #533afd の filled pill を 1 バンドに 1 個
- **細ウェイト (300)** — Sohne/Inter の thin は負のトラッキングと組み合わせたブランドシグネチャー
- **tnum** — 数値コンテンツすべてに tabular figures で金融 DNA を静かに表現
- **ダークネイビー反転** — フィーチャー中価格ティアを brand-dark-900 (#1c1e54) で反転
- **クリームバンド** — canvas-cream (#f5e9d4) でインジゴ/ホワイトのリズムにウォームな間奏
