---
source: https://github.com/voltagent/awesome-design-md/tree/main/design-md/apple
last_updated: 2026-06-25
---

# Apple — デザインシステム参照

> ライト×ダーク交互タイル × SF Pro 負のトラッキング × Action Blue 単色インタラクティブの写真ギャラリー型マーケティング。
> UI クロムを消して製品に語らせる — 装飾グラジエントなし、クロムシャドウなし、写真下の一点シグネチャードロップシャドウのみ。

---

## カラートークン

```yaml
colors:
  primary: "#0066cc"          # Action Blue — すべてのインタラクティブ要素（リンク・ボタン）
  primary-focus: "#0071e3"    # フォーカス・hover
  primary-on-dark: "#2997ff"  # ダークサーフェス上の Action Blue
  ink: "#1d1d1f"              # 主テキスト（純黒ではない — わずかに暖かい）
  body: "#1d1d1f"
  body-on-dark: "#ffffff"
  body-muted: "#cccccc"       # ダーク上のミュートテキスト
  ink-muted-80: "#333333"     # セカンダリテキスト
  ink-muted-48: "#7a7a7a"     # ヘルパー・フッターリンク
  divider-soft: "#f0f0f0"     # セクションナビ下の薄区切り
  hairline: "#e0e0e0"         # 1px カードボーダー
  canvas: "#ffffff"           # ライトページ背景
  canvas-parchment: "#f5f5f7" # 羊皮紙オフホワイト（製品タイル・フィーチャーバンド）
  surface-pearl: "#fafafc"    # 薄コンテナ背景
  surface-tile-1: "#272729"   # ダークタイル（製品タイル 1）
  surface-tile-2: "#2a2a2c"   # ダークタイル（製品タイル 2）
  surface-tile-3: "#252527"   # ダークタイル（製品タイル 3）
  surface-black: "#000000"    # グローバルナビ背景
  on-primary: "#ffffff"
  on-dark: "#ffffff"
```

---

## タイポグラフィ

| トークン | サイズ | ウェイト | 行高 | letter-spacing | 用途 |
|---|---|---|---|---|---|
| hero-display | 56px | 600 | 1.07 | -0.28px | ヒーロー見出し |
| display-lg | 40px | 600 | 1.1 | 0 | セクション冒頭 |
| display-md | 34px | 600 | 1.47 | -0.374px | フィーチャーカードタイトル |
| lead | 28px | 400 | 1.14 | +0.196px | ヒーローサブヘッド（正トラッキング） |
| lead-airy | 24px | 300 | 1.5 | 0 | 軽快なマーケティングリード |
| tagline | 21px | 600 | 1.19 | +0.231px | キャッチコピー・タグライン |
| body-strong | 17px | 600 | 1.24 | -0.374px | 強調本文 |
| body | 17px | 400 | 1.47 | -0.374px | デフォルト本文 |
| caption | 14px | 400 | 1.43 | -0.224px | キャプション・フッターリンク |
| button-large | 18px | 300 | 1.0 | 0 | ストアヒーロー CTA（薄ウェイト） |
| button-utility | 14px | 400 | 1.29 | -0.224px | ユーティリティボタン |
| nav-link | 12px | 400 | 1.0 | -0.12px | グローバルナビ |

**フォントファミリー:** SF Pro Display / SF Pro Text（system-ui / -apple-system で自動取得）

**原則:**
- **SF Pro が system font** — `font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", ...` で実質無償使用可能
- **display は weight 600** — hero 見出しは必ず 600。700 以上はシステムに存在しない
- **ストアヒーロー CTA は weight 300** — 細ウェイトの行動喚起が Apple の "quiet confidence"
- **負のトラッキング** — 34px display で -0.374px（OpenType 相当の tight set）

---

## ボーダーラジウス・スペーシング

```yaml
rounded:
  none: 0px
  xs: 5px
  sm: 8px       # utility ボタン・ダークユーティリティ
  md: 11px      # pearl capsule ボタン
  lg: 18px      # 製品タイル・フィーチャーカード
  pill: 9999px  # 主要ボタン（store hero, primary pill）
  full: 9999px  # アイコンボタン円形

spacing:
  xxs: 4px  xs: 8px  sm: 12px  md: 17px
  lg: 24px  xl: 32px  xxl: 48px  section: 80px
```

> **pill と lg の 2 スケール** — マーケティング主要 CTA は pill、ユーティリティ系は sm/md の小角丸。

---

## 主要コンポーネント

### ボタン

| コンポーネント | 背景 | テキスト | 形状 | 用途 |
|---|---|---|---|---|
| button-primary | primary (#0066cc) | on-primary | pill | 標準 CTA |
| button-secondary-pill | canvas | primary | pill | 副 CTA（ライト） |
| button-store-hero | primary (#0066cc) | on-primary | pill | ストアヒーロー（18px / 300） |
| button-dark-utility | ink (#1d1d1f) | on-dark | rounded-sm | ダーク utility（14px / 400） |
| button-pearl-capsule | surface-pearl | ink-muted-80 | rounded-md | ミニ utility / 比較リンク |
| button-icon-circular | surface-chip-translucent | ink | full (44px) | アイコンボタン |

### タイル構造

Apple マーケティングページは **フルブリード製品タイル**を交互に積み上げる構造：
- **Light tile** — `canvas-parchment` (#f5f5f7) 背景に製品写真
- **Dark tile** — `surface-tile-1/2/3` (#272729 等) 背景に製品写真
- 製品写真はタイルから **独立してフロート**、底面に単一ドロップシャドウ

### グローバルナビ

- 背景 `surface-black` (#000000)、高さ 44px
- テキスト on-dark、nav-link フォント（12px / 400）
- Apple ロゴ中央、製品カテゴリ横並び、検索・バッグアイコン右端

---

## エレベーション

| レベル | 表現 | 用途 |
|---|---|---|
| 0 | フラット | ナビ・フッター・タイルバンド |
| 1 | `0 20px 40px rgba(0,0,0,0.15)` | **製品写真のシグネチャードロップシャドウ** |
| 2 | `divider-soft` 1px | セクションナビ下区切り |

Apple は **クロムにシャドウを使わない**。シャドウは製品写真がサーフェスに置かれている演出のみ（Level 1）。

---

## Do's and Don'ts

### Do
- すべてのインタラクティブ要素（ボタン・リンク）を `primary` (#0066cc) で統一する
- display 見出しを weight 600 + 負のトラッキングで設定する
- ライト/ダークタイルを交互に積んで製品を見せる
- 製品写真に単一ドロップシャドウ（Level 1）を使う — クロムには使わない
- システムフォント `SF Pro` を `-apple-system` で使う
- `canvas-parchment` (#f5f5f7) をライトタイルの背景に使う（純白より温かい）

### Don't
- 装飾グラジエントを追加しない（バックグラウンドはフラット単色）
- UI クロム（ナビ・ボタン・カード）にドロップシャドウを使わない
- `primary` Action Blue をテキストカラーに使わない（CTA・リンクのみ）
- weight 700 以上を display に使わない（600 が上限）
- 複数のアクセントカラーを追加しない（Action Blue 一色）

---

## キー特性サマリー

- **写真ギャラリー型** — 製品タイルのライト↔ダーク交互積み上げが Apple の core 構造
- **Action Blue 単色** — #0066cc がすべてのインタラクション。装飾用途には使わない
- **クロムが消える** — ナビ・ボタン・カードは最小限。製品が主役
- **製品写真ドロップシャドウ** — 唯一のシャドウ。「テーブルの上に置かれた製品」の物理的演出
- **SF Pro システムフォント** — Apple デバイスで自動取得。他デバイスは system-ui フォールバック
- **canvas-parchment** — #f5f5f7 の羊皮紙ニュアンス。pure white より製品写真が引き立つ
