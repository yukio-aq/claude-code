---
source: https://github.com/voltagent/awesome-design-md/tree/main/design-md/bmw
last_updated: 2026-06-25
---

# BMW — デザインシステム参照

> ライトキャンバス × BMW コーポレートブルー単色 × 700/300 ウェイトコントラストの自動車コーポレートブランド。
> 0px コーナーのレクタングルボタン、ダークネイビーヒーローバンド、M トリカラーはモータースポーツ文脈のみ。

---

## カラートークン

```yaml
colors:
  primary: "#1c69d4"          # BMW コーポレートブルー — すべての primary CTA
  primary-active: "#0653b6"   # pressed 状態
  primary-disabled: "#d6d6d6"
  ink: "#262626"              # 主見出し・primary テキスト（純黒ではない）
  body: "#3c3c3c"             # デフォルト本文
  body-strong: "#1a1a1a"      # 強調段落・リードテキスト
  muted: "#6b6b6b"            # フッターリンク・キャプション
  muted-soft: "#9a9a9a"       # disabled テキスト
  hairline: "#e6e6e6"         # 1px ボーダー（入力・コンフィギュレーター）
  hairline-strong: "#cccccc"  # より強調した 1px ボーダー
  canvas: "#ffffff"           # ページ背景
  surface-soft: "#f7f7f7"     # フッター・サブナビバンド
  surface-card: "#fafafa"     # モデルカードの写真プレート背景
  surface-dark: "#1a2129"     # ヒーローバンド（ダークネイビー）
  surface-dark-elevated: "#262e38"  # ダークヒーロー上のネストカード
  on-primary: "#ffffff"
  on-dark: "#ffffff"
  on-dark-soft: "#bbbbbb"     # ダークバンド上のセカンダリテキスト
  m-blue-light: "#0066b1"     # M トリカラー（M モデル文脈のみ）
  m-blue-dark: "#1c69d4"      # M トリカラー（M モデル文脈のみ）
  m-red: "#e22718"            # M トリカラー（M モデル文脈のみ）
  success: "#22c55e"
  warning: "#f59e0b"
  error: "#dc2626"
```

---

## タイポグラフィ

| トークン | サイズ | ウェイト | 行高 | letter-spacing | 用途 |
|---|---|---|---|---|---|
| display-xl | 64px | 700 | 1.05 | 0 | ヒーロー h1（モデル名） |
| display-lg | 48px | 700 | 1.1 | 0 | セクション見出し |
| display-md | 32px | 700 | 1.15 | 0 | サブセクション見出し |
| display-sm | 24px | 700 | 1.25 | 0 | CTA バンドヘッドライン |
| title-lg | 20px | 700 | 1.3 | 0 | カードグループタイトル |
| title-md | 18px | 700 | 1.4 | 0 | モデルカードタイトル |
| title-sm | 16px | 700 | 1.4 | 0 | インベントリカードタイトル |
| body-md | 16px | 300 (Light) | 1.55 | 0 | デフォルト本文 |
| body-sm | 14px | 300 (Light) | 1.55 | 0 | フッター本文 |
| caption | 12px | 400 | 1.4 | 0.5px | 写真キャプション・メタ |
| label-uppercase | 13px | 700 | 1.3 | 1.5px | "LEARN MORE" インラインリンク・カテゴリタブ |
| button | 14px | 700 | 1.0 | 0.5px | CTA ボタンラベル |
| nav-link | 14px | 400 | 1.4 | 0.3px | トップナビメニュー |

**フォントファミリー:** BMW Type Next Latin（ライセンスフォント）→ 代替: **Inter** weight 700/300

**原則:**
- **700/300 コントラストがシグネチャー** — weight 500 はシステムに存在しない。400 はキャプション・nav のみ
- **UPPERCASE インラインリンク** — "LEARN MORE" スタイルは uppercase + 1.5px tracking
- **負のトラッキングなし** — BMW Type Next Latin はデフォルト tracking のまま使用

---

## ボーダーラジウス・スペーシング

```yaml
rounded:
  none: 0px   # すべてのボタン・カード・入力 — ブランドの矩形シグネチャー
  xs: 2px     # 極小バッジ（まれ）
  sm: 4px     # 小インラインボタン（まれ）
  md: 8px     # モバイル専用（まれ）
  lg: 12px    # モーダル・ダイアログ角（まれ）
  pill: 9999px  # フィルターチップ（一部コンテキスト）
  full: 9999px  # アイコンボタン円形

spacing:
  xxs: 4px  xs: 8px  sm: 12px  md: 16px
  lg: 24px  xl: 32px  xxl: 48px  section: 80px
```

> **矩形が支配的** — rounded.none がすべてのボタン・カード・入力に適用。Pill はフィルターチップの一部のみ。

---

## 主要コンポーネント

### ボタン

| コンポーネント | 背景 | テキスト | 形状 | padding |
|---|---|---|---|---|
| button-primary | primary (#1c69d4) | on-primary | 0px | 14px × 32px |
| button-secondary | canvas | ink | 0px + 1px hairline-strong | 13px × 31px |
| button-secondary-on-dark | transparent | on-dark | 0px + 1px on-dark border | 13px × 31px |
| button-text-link | transparent | ink | — | uppercase label-uppercase |

### カード・バンド

| コンポーネント | 背景 | 用途 |
|---|---|---|
| hero-band-dark | surface-dark (#1a2129) | ダークネイビーヒーロー（ページ 1 本） |
| model-card | canvas | モデル 4-up / 5-up グリッド |
| spec-cell | transparent | スペック数値（display-sm） |
| inventory-card | canvas | ディーラーインベントリ |

### シグネチャー

**M stripe divider** — 4px 高水平 M トリカラーストライプ（`m-blue-light` → `m-blue-dark` → `m-red`）。M モデルページ・モータースポーツバッジのみ使用。コーポレートメインフローには出現しない。

---

## エレベーション

| レベル | 表現 | 用途 |
|---|---|---|
| Flat | シャドウなし | 本文・ナビ・フッター・ヒーロー |
| Hairline | 1px hairline ボーダー | コンフィギュレーターオプションタイル |
| Surface card | surface-card 背景（シャドウなし） | モデルカード写真プレート |
| Photographic | フルブリード写真 | ヒーローバンド・モデルレンダー |

BMW はドロップシャドウを使わない。深度はカラーブロックコントラスト（light canvas vs dark hero）+ 写真のみ。

---

## Do's and Don'ts

### Do
- すべての CTA を `button-primary`（BMW ブルー + 0px コーナー）で統一する
- body を BMW Type Next Latin Light（300）で設定する — Bold は不可
- display を weight 700 のみ使用する（500 はシステムに存在しない）
- "LEARN MORE" スタイルの inline CTA を uppercase + 1.5px tracking で使う
- section rhythm を 80px に保つ
- M トリカラーストライプを M モデル文脈のみに限定する

### Don't
- BMW ブルー以外のブランドカラーを追加しない（primary 一色で運用）
- ボタンに pill / rounded コーナーを使わない（0px 矩形のみ）
- display を weight 500 にしない（700/300 の二択）
- body テキストを bold にしない（Light 300 が BMW コーポレートの editorial 声）
- カードにドロップシャドウを追加しない
- M トリカラーストライプを CTA の fill に使わない（divider/accent 役のみ）
- 2 バンド連続で同じサーフェスモード（light→light や dark→dark）にしない

---

## キー特性サマリー

- **BMW ブルー単色 CTA** — #1c69d4 が唯一の primary アクション色。M トリカラーはモータースポーツ文脈のみ
- **700/300 コントラスト** — heavy display と light body の極端なウェイト差が editorial シグネチャー
- **0px 矩形ボタン** — "engineered precision" の言語。SaaS の soft corner とは対極
- **ダークネイビーヒーロー** — surface-dark (#1a2129) が 1 ページに 1 バンド。ライト↔ダークのリズム
- **写真が深度のすべて** — フルブリード車両写真 + カラーブロックコントラストでシャドウ不要
- **密度は高め** — セクション 80px（BMW M の 96px より小さい）。ディーラー機能的な密度
