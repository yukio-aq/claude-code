---
source: https://github.com/voltagent/awesome-design-md/tree/main/design-md/vercel
last_updated: 2026-06-25
---

# Vercel — デザインシステム参照

> 白キャンバス × 純黒インク × マルチカラーメッシュグラジエント（ヒーローのみ）のデベロッパープラットフォームブランド。
> Geist フォント + mono キャプション、100px pill CTA、スタックシャドウで作られる「静かな技術的洗練」。

---

## カラートークン

```yaml
colors:
  primary: "#171717"           # 純黒インク — primary CTA かつ主テキスト
  on-primary: "#ffffff"
  ink: "#171717"               # デフォルトヘッドライン・ボディ
  body: "#4d4d4d"              # セカンダリテキスト
  mute: "#888888"              # ヘルパー・フッター・無効状態
  hairline: "#ebebeb"          # カード・テーブルの 1px ボーダー
  hairline-strong: "#a1a1a1"
  canvas: "#ffffff"            # ページ背景
  canvas-soft: "#fafafa"       # やや暗いオフホワイト（フィーチャーバンド）
  canvas-soft-2: "#f5f5f5"
  link: "#0070f3"              # インラインリンク
  success: "#0070f3"
  error: "#ee0000"
  warning: "#f5a623"
  violet: "#7928ca"            # グラジエントペア（Preview トラック）
  cyan: "#50e3c2"              # グラジエントペア（Develop トラック）
  highlight-pink: "#ff0080"    # グラジエントペア（Ship トラック）

  # ヒーローグラジエントペア（段階的カラーペアとしてのみ使用）
  gradient-develop-start: "#007cf0"   gradient-develop-end: "#00dfd8"
  gradient-preview-start: "#7928ca"   gradient-preview-end: "#ff0080"
  gradient-ship-start: "#ff4d4d"      gradient-ship-end: "#f9cb28"
```

---

## タイポグラフィ

| トークン | サイズ | ウェイト | 行高 | letter-spacing | 用途 |
|---|---|---|---|---|---|
| display-xl | 48px | 600 | 48px | -2.4px | ヒーロー見出し |
| display-lg | 32px | 600 | 40px | -1.28px | セクション冒頭 |
| display-md | 24px | 600 | 32px | -0.96px | フィーチャーカードタイトル |
| display-sm | 20px | 600 | 28px | -0.6px | 小カードタイトル |
| body-lg | 18px | 400 | 28px | 0 | ヒーローサブヘッド |
| body-md | 16px | 400 | 24px | 0 | デフォルト本文 |
| body-sm | 14px | 400 | 20px | -0.28px | カード本文・フッターリンク |
| caption | 12px | 400 | 16px | 0 | キャプション |
| caption-mono | 12px | 400 | 16px | 0 | 技術ラベル（Geist Mono） |
| code | 13px | 400 | 20px | 0 | コードブロック（Geist Mono） |
| button-md | 14px | 500 | 20px | 0 | ボタンラベル（小） |
| button-lg | 16px | 500 | 24px | 0 | ボタンラベル（大） |

**フォントファミリー:**
- **Geist** (sans-serif) — ヘッドライン・ボディ・ボタン全般
- **Geist Mono** — コードブロック・技術 eyebrow ラベル（`caption-mono`）

**原則:**
- **weight 600 が上限** — display で 700 以上は使わない
- **sentence-case + ピリオド終端** — ヒーロー見出しは文頭大文字のみ、ピリオドで終わることが多い
- **mono は技術ラベルのみ** — `caption-mono` で技術的 eyebrow ラベル、コードブロック以外の本文に mono を使わない
- **負のトラッキング** — 48px で -2.4px（約 5%）のアグレッシブな negative tracking

---

## ボーダーラジウス・スペーシング

```yaml
rounded:
  none: 0px
  xs: 4px     # インラインピル
  sm: 6px     # nav スケールボタン・フォーム入力（--geist-radius）
  md: 8px     # フィーチャーカード・テンプレートカード（--geist-marketing-radius）
  lg: 12px    # 価格カード・大カード
  xl: 16px    # ヒーロー画像ホストカード
  pill-sm: 64px   # タブゴーストピル
  pill: 100px     # マーケティング CTA pill（button-primary / secondary）
  full: 9999px    # アイコンボタン・nav リンクゴーストピル

spacing:
  xxs: 4px  xs: 8px  sm: 12px  md: 16px  lg: 24px
  xl: 32px  2xl: 40px  3xl: 48px  4xl: 64px  5xl: 96px
  6xl: 128px  section: 192px
```

> **2スケールの pill が共存** — マーケティング CTA は `pill` (100px)、nav ボタンは `sm` (6px)。同一画面で両方使う。

---

## 主要コンポーネント

### ボタン

| コンポーネント | 背景 | テキスト | 形状 | 用途 |
|---|---|---|---|---|
| button-primary | primary (#171717) | on-primary | pill (100px) | マーケティング CTA |
| button-secondary | canvas (#fff) | ink | pill (100px) | 副 CTA |
| button-primary-sm | primary | on-primary | pill (100px) | nav・価格カード内 |
| button-secondary-sm | canvas | ink | pill (100px) | 副 CTA 小 |
| nav-cta-signup | primary | on-primary | rounded-sm (6px) | nav の右端 Sign Up |
| nav-cta-login | canvas | ink | rounded-sm | nav の Log In |
| nav-cta-ask-ai | canvas | ink + hairline border | rounded-sm | nav の Ask AI |
| tab-ghost | canvas | ink | pill-sm (64px) | タブ行（AI Apps等） |

### カード

| コンポーネント | 背景 | 角丸 | padding | シャドウ |
|---|---|---|---|---|
| card-marketing | canvas | rounded-md (8px) | 24px | Level 3（Soft Stack） |
| card-marketing-large | canvas | rounded-lg (12px) | 32px | Level 4（Float Stack） |
| card-soft | canvas-soft | rounded-md | 24px | — |
| template-card | canvas | rounded-md | 16px | Level 2 + 16:9 サムネイル |
| code-editor-mockup | primary (黒) | on-primary | 24px | — |
| pricing-card | canvas | rounded-lg | 32px | Level 4 |
| pricing-card-featured | primary (黒) | on-primary | 32px | — |

### シグネチャーコンポーネント

**メッシュグラジエントバックドロップ** — cyan/blue/magenta/amber のマルチストップグラジエント。ヒーロースケールのみ使用、アイコンや小要素への縮小不可。

**polarity-flip ダークバンド** — `primary` (#171717) 背景のセクション（「A compute model for all workloads」等）。ライト→ダークのセクション深度切り替えの主要手法。

**スタックシャドウ** — 複数の小オフセットを重ねる（`0px 2px 2px #0000000a, 0px 8px 8px -8px #0000000a` 等）。単一の大きなドロップシャドウは使わない。

---

## エレベーション（スタックシャドウシステム）

| レベル | シャドウ | 用途 |
|---|---|---|
| Level 0 | なし | フルブリードヒーロー・フッター |
| Level 1 | `0 0 0 1px #00000014`（インセット） | デフォルトカードクロム |
| Level 2 | `0 1px 1px #5, 0 2px 2px #0a` + Level 1 inset | テンプレートカード・マーケティングカード |
| Level 3 | `0 2px 2px #0a, 0 8px 8px -8px #0a` + inset | フィーチャーグリッドカード |
| Level 4 | `0 2px 2px #0a, 0 8px 16px -4px #0a` + inset | 価格カード・コールアウトパネル |
| Level 5 | `0 1px 1px #5, 0 8px 16px -4px #0a, 0 24px 32px -8px #0f` + inset | モーダル・ドロップダウン |

---

## Do's and Don'ts

### Do
- `primary` (#171717) を primary CTA に使う — 黒インクがコンバージョンターゲット
- マーケティングCTA は `pill` (100px)、nav ボタンは `rounded-sm` (6px) の 2スケールを使い分ける
- すべての display 見出しを weight 600、sentence-case、負のトラッキングで設定する
- メッシュグラジエントはヒーロースケールのみに適用する（縮小・単色化不可）
- カードにはスタックシャドウ（複数小オフセット + インセットヘアライン）を使う
- セクション表面を `canvas-soft` → `canvas` → `primary`（polarity-flip）でサイクルさせる
- コードブロックと技術 eyebrow ラベルには `caption-mono`（Geist Mono）を使う

### Don't
- 新しい 6 個目のアクセントカラーを追加しない（インク・グレー + 4 ペアグラジエントで運用）
- 見出しを all-caps にしない（sentence-case + 負のトラッキングが非交渉）
- 単一の大きなドロップシャドウを使わない（スタックシャドウで代替）
- メッシュグラジエントをアイコンや小要素に縮小しない（ヒーロースケール専用）
- display を weight 700 以上にしない（上限 600）
- 本文段落に mono フォントを使わない（mono はコード・技術ラベルのみ）

---

## キー特性サマリー

- **インクプライマリ** — #171717 の純黒インクが CTA カラー、ヒーロー上では主張する存在感
- **Geist フォント** — Vercel 製オープンソースフォント（sans + mono）が公式に使用可能
- **100px pill + 6px sm の 2スケール** — マーケティングと nav で意図的に異なる pill スケールを使い分ける
- **polarity-flip** — `primary` 黒セクションへの切り替えがブランドの主要な深度手法
- **スタックシャドウ** — 単一ドロップシャドウではなく複数小オフセットの積み重ねで自然な光を表現
- **sentence-case + ピリオド** — 見出しの文末ピリオドが Vercel の独特な typographic voice
