---
source: https://github.com/voltagent/awesome-design-md/tree/main/design-md/raycast
last_updated: 2026-06-25
---

# Raycast — デザインシステム参照

> マーケティングページを「製品スクリーンショットの延長」として扱うダークデベロッパーツールシステム。
> 純黒に近いキャンバス、白の CTA pill、Inter + ss03 スタイルセット、コマンドパレット風カード。

---

## カラートークン

```yaml
colors:
  # CTA
  primary: "#ffffff"           # 唯一の primary CTA — ダークキャンバス上の白 pill
  primary-pressed: "#e8e8e8"
  on-primary: "#000000"        # 白 pill 上のテキスト（システム中唯一の純黒テキスト）

  # サーフェス（4段階ラダー）
  canvas: "#07080a"            # ページ背景 — ほぼ純黒
  surface: "#0d0d0d"           # カード・エレベーテッドパネル
  surface-elevated: "#101111"  # ボタン3次・テキスト入力・ストア検索バー
  surface-card: "#121212"      # アプリアイコンタイル・キーキャップ・コマンドパレット行ホバー
  button-fg: "#18191a"         # フィーチャー中価格ティアカード内深色バリアント

  # ボーダー
  hairline: "#242728"          # すべてのカードエッジ共通 1px ボーダー
  hairline-soft: "rgba(255,255,255,0.08)"
  hairline-strong: "rgba(255,255,255,0.16)"

  # テキスト
  ink: "#f4f4f6"               # ダークキャンバス上の主見出し
  body: "#cdcdcd"              # デフォルト本文・インラインリンク
  mute: "#9c9c9d"              # メタデータ・フッターリンク・セカンダリキャプション
  ash: "#6a6b6c"               # disabled テキスト・最小強調
  stone: "#434345"             # 最低強調キャプション・disabled アイコン

  # カテゴリアクセント（拡張機能タイルのイラスト用のみ。クロムには使わない）
  accent-blue: "#57c1ff"       accent-blue-soft: "rgba(87,193,255,0.15)"
  accent-red: "#ff6161"        accent-red-soft: "rgba(255,97,97,0.15)"
  accent-green: "#59d499"      accent-green-soft: "rgba(89,212,153,0.15)"
  accent-yellow: "#ffc533"     accent-yellow-soft: "rgba(255,197,51,0.15)"

  # シグネチャー
  hero-stripe-start: "#ff5757"  # ホームヒーロー赤斜めストライプ（1ページ最大1回）
  hero-stripe-end: "#a1131a"
```

---

## タイポグラフィ

| トークン | サイズ | ウェイト | 行高 | letter-spacing | 用途 |
|---|---|---|---|---|---|
| display-xl | 64px | 600 | 1.1 | 0 | ヒーロー見出し |
| display-lg | 56px | 500 | 1.17 | +0.2px | セクション見出し |
| heading-xl | 24px | 500 | 1.6 | +0.2px | サブセクション・価格ティア名 |
| heading-lg | 22px | 500 | 1.15 | 0 | ミッドセクション見出し |
| heading-md | 20px | 500 | 1.4 | +0.2px | フィーチャー小見出し |
| body-lg | 18px | 400 | 1.6 | 0 | 本文リード |
| body-md | 16px | 400 | 1.6 | 0 | デフォルト本文 |
| body-sm | 14px | 400 | 1.6 | 0 | カード本文・フッターリンク |
| caption-md | 13px | 400 | 1.4 | +0.1px | メタ・テーブルラベル |
| caption-sm | 12px | 400 | 1.5 | +0.4px | 最小テキスト |
| button-md | 14px | 500 | 1.6 | +0.2px | ボタンラベル |

**フォントファミリー:** Inter（`font-feature-settings: "calt", "kern", "liga", "ss03"`）
- **ss03 が必須** — Inter の代替 `g` グリフ（single-story open g）がブランドタイポグラフィのシグネチャー

**原則:**
- `ss03` をサイト全体に適用する（`body` 要素の `font-feature-settings` に設定）
- display は weight 600（Linear と異なり太い）、section は weight 500
- ヒーローワードマークには `ss02`、`ss08` を追加し `liga` を無効化

---

## ボーダーラジウス・スペーシング

```yaml
rounded:
  none: 0px
  xs: 4px    # キーキャップ・ステータスバッジ
  sm: 6px    # コマンドパレット行
  md: 8px    # ボタン・テキスト入力・ストア拡張カード
  lg: 10px   # フィーチャーカード・コマンドパレットカード
  xl: 16px   # ヒーローコマンドパレットモックアップコンテナ
  full: 9999px  # pill タブ

spacing:
  xxs: 2px  xs: 4px   sm: 8px   md: 12px
  lg: 16px  xl: 24px  xxl: 32px  section: 96px
```

---

## 主要コンポーネント

### ボタン

| コンポーネント | 背景 | テキスト | 形状 | 高さ |
|---|---|---|---|---|
| button-primary | white (#fff) | black | rounded-md (8px) | 36px |
| button-secondary | transparent | on-dark | rounded-md | 36px |
| button-tertiary | surface-elevated | on-dark | rounded-md | 36px |

> **Raycast の primary は白** — ダークキャンバス上の白い pill が唯一の primary アクション。

### カード

| コンポーネント | 背景 | 角丸 | padding |
|---|---|---|---|
| command-palette-card | surface | rounded-lg (10px) | 0px（内部でセパレート） |
| feature-card-dark | surface | rounded-lg | 24px |
| feature-card-elevated | surface-elevated | rounded-lg | 24px |
| store-extension-card | surface | rounded-md (8px) | 16px |
| pricing-tier-card | surface | rounded-lg | 24px |
| pricing-tier-card-featured | surface-elevated | rounded-lg | 24px |

### ユニークコンポーネント

**keycap** — キーボードショートカット表示。`surface-card` 背景、`caption-md` フォント、`rounded-xs` (4px)、`1px 6px` padding、高さ 20px。
```
⌘ K  ←  こういうキーキャップ UI
```

**badge-info-soft** — `accent-blue-soft` 背景 + `accent-blue` テキスト。カテゴリアクセントを含む唯一のカラフルバッジ。

**pill-tab / pill-tab-active** — `rounded-full` のタブナビゲーション。active は `surface-elevated` 背景。

---

## エレベーション

Raycast **はシャドウを使わない**。深度はサーフェスラダー + `hairline` (#242728) の 1px ボーダーのみで表現する。

| レベル | 表現 |
|---|---|
| 0 | canvas (#07080a) フラット |
| 1 | surface (#0d0d0d) + 1px hairline |
| 2 | surface-elevated (#101111) + 1px hairline |
| 3 | surface-card (#121212) + 1px hairline |

---

## Do's and Don'ts

### Do
- `ss03` を `body` 要素に `font-feature-settings` でグローバル適用する
- すべての primary アクションを白 pill で統一する（ダーク上では白が primary）
- カテゴリアクセント（yellow/red/green/blue）を拡張機能タイルのイラスト内のみに使う
- 1px `hairline` (#242728) をすべてのカードエッジに使う（シャドウ不使用）
- ヒーロー赤ストライプはページにつき最大 1 回に限定する
- マルチレディウスのカード語彙を使い分ける（sm: コマンド行 / md: ボタン / lg: フィーチャーカード / xl: モックアップコンテナ）

### Don't
- クロム（UI要素）にカテゴリアクセントカラーを使わない
- システムにドロップシャドウを追加しない（サーフェスラダー + ヘアラインで代替）
- white 以外を primary CTA 色にしない
- ダークキャンバスをライトモードに切り替えない（サイト全体が 1 つの連続ダークモード）
- アイコン・イラスト等にヒーロー赤ストライプグラジエントを使い回さない

---

## キー特性サマリー

- **マーケティングページ = 製品画面の延長** — クロムがそのままコマンドパレット UI のスケールアップ版
- **白が primary** — ダークシステムでは white (#fff) が primary CTA
- **Inter + ss03** — ss03 代替 `g` グリフがブランドタイポグラフィのシグネチャー
- **シャドウなし** — 深度は 4 段階サーフェスラダー + hairline (#242728) のみ
- **アクセントはタイル内のみ** — yellow/red/green/blue は拡張機能イラストにのみ存在、クロムはモノクロ
- **赤ストライプヒーロー** — ページ最上部の斜め赤ストライプが唯一のクロマティックグラジエント
