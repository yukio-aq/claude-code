---
source: https://github.com/voltagent/awesome-design-md/tree/main/design-md/ferrari
last_updated: 2026-06-25
---

# Ferrari — デザインシステム参照

> ニアブラックキャンバス × ロッソコルサ一点集中 × フルブリードシネマティック写真のプレミアムスポーツカーブランド。
> シャープ 0px コーナー、FerrariSans weight 500 上限、スペックディスプレイ 80px が「エンジニアリングの詩」を作る。

---

## カラートークン

```yaml
colors:
  primary: "#da291c"          # ロッソコルサ — CTA・カヴァリーノ・F1ハイライトのみ
  on-primary: "#ffffff"
  canvas: "#181818"           # ニアブラック（純黒ではない — 暖かみのあるダーク）
  canvas-elevated: "#303030"  # カードサーフェス
  canvas-deep: "#0f0f0f"      # 最深バンド（ページ最下部等）
  ink: "#ffffff"              # 全テキスト（ダークキャンバス上）
  ink-secondary: "#cccccc"    # サブテキスト
  ink-muted: "#999999"        # メタデータ・フッターリンク
  hairline: "#2e2e2e"         # 1px カードエッジ
  hairline-strong: "#444444"  # より強調したボーダー
  on-dark: "#ffffff"
  error: "#da291c"            # エラーも primary red を流用
```

---

## タイポグラフィ

| トークン | サイズ | ウェイト | 行高 | letter-spacing | 用途 |
|---|---|---|---|---|---|
| display-mega | 80px | 700 | 1.0 | 0 | スペック数値（0-100km/h 等）|
| display-xl | 56px | 500 | 1.05 | 0 | ヒーロー見出し |
| display-lg | 40px | 500 | 1.1 | 0 | セクション冒頭 |
| display-md | 28px | 500 | 1.2 | 0 | フィーチャータイトル |
| heading-lg | 22px | 500 | 1.3 | 0 | カードタイトル |
| heading-md | 18px | 500 | 1.4 | 0 | サブセクション |
| body-md | 16px | 400 | 1.6 | 0 | デフォルト本文 |
| body-sm | 14px | 400 | 1.6 | 0 | フッター・キャプション |
| button | 14px | 500 | 1.0 | 1.4px | CTA ボタン（uppercase） |
| eyebrow | 12px | 500 | 1.2 | 1.4px | カテゴリラベル（uppercase） |

**フォントファミリー:** FerrariSans（ライセンスフォント）→ 代替: **Inter weight 500**

**原則:**
- **weight 500 が上限** — display で 700 は `display-mega`（スペック数値）のみ。見出しは 500 を守る
- **CTA と nav は uppercase + 1.4px tracking** — 全小文字の本文との視覚的コントラストを作る
- **スペック数値は 80px / 700** — テクニカルスペックセルの支配的な数字表示

---

## ボーダーラジウス・スペーシング

```yaml
rounded:
  none: 0px   # すべてのボタン・カード・入力 — シャープコーナーがブランドシグネチャー

spacing:
  xxxs: 4px  xxs: 8px  xs: 16px  sm: 24px
  md: 32px   lg: 48px  xl: 64px  xxl: 96px  super: 128px
```

> **0px コーナーのみ** — rounded.none が唯一。pill/rounded-rect は Ferrari の言語外。

---

## 主要コンポーネント

### ボタン

| コンポーネント | 背景 | テキスト | 形状 | 特記 |
|---|---|---|---|---|
| button-primary | primary (#da291c) | on-primary | 0px sharp | uppercase + 1.4px tracking |
| button-secondary | transparent | ink (#fff) | 0px + 1px hairline | uppercase + 1.4px tracking |
| button-ghost | canvas | ink | 0px | uppercase + 1.4px tracking |

### カード・バンド

| コンポーネント | 背景 | 用途 |
|---|---|---|
| hero-band-cinema | canvas (#181818) | フルブリード映画的ヒーロー写真 |
| livery-band | primary (#da291c) | ロッソコルサの全幅バンド（CTA直前等） |
| spec-cell | canvas-elevated | スペック数値 80px/700 + ラベル uppercase |
| race-position-cell | canvas + primary accent | F1リザルト・レースポジション表示 |

### ナビ・フッター

- **top-nav**: canvas 背景、高さ 64px、eyebrow フォント（uppercase）
- **footer**: canvas-deep (#0f0f0f)、ink-muted テキスト、caption フォント

---

## エレベーション（深度表現）

Ferrari **はドロップシャドウを使わない**。深度はニアブラックキャンバス × フルブリード写真のみで表現する。

| レベル | 表現 |
|---|---|
| 0 | canvas (#181818) フラット |
| 1 | canvas-elevated (#303030) + 1px hairline |
| 2 | livery-band（Rosso Corsaの全幅赤バンド）で区切る |
| 深度の主役 | フルブリードシネマティック写真（照明 + 被写体）|

---

## Do's and Don'ts

### Do
- すべての CTA を 0px シャープコーナーにする（pill / rounded-rect は不可）
- `primary` (#da291c) は CTA・カヴァリーノマーク・F1ハイライトの3用途に限定する
- display 見出しを weight 500 に抑える（display-mega の 700 は数値スペックのみ）
- CTA・nav テキストを uppercase + 1.4px tracking にする
- スペックセルの数値に 80px / 700 / tabular を使う
- ヒーローの深度をフルブリード映画写真のみで表現する（シャドウ不使用）
- canvas を #181818 にする（純黒 #000000 は使わない — 暖かみのある暗さが Ferrari）

### Don't
- ボタンや CTA に rounded corners を使わない（0px のみ）
- display を weight 700 以上にしない（スペック数値の display-mega 以外）
- `primary` red をセクション背景や装飾グラジエントに使わない（単独の視覚的アクセントとして機能させる）
- ドロップシャドウを追加しない
- 純黒 (#000000) をキャンバスに使わない（#181818 を使う）
- ライトモードのページを作らない

---

## キー特性サマリー

- **ロッソコルサ一点集中** — #da291c は 3 用途のみ（CTA・カヴァリーノ・F1）。装飾目的不可
- **ニアブラック #181818** — 純黒より暖かいキャンバス。Ferrari の夜のガレージの温度感
- **0px everywhere** — ボタン・カード・入力すべてシャープコーナー。エンジニアリングの精密さ
- **weight 500 上限** — bold を使わない display が「鍛造された力」を表現
- **シネマティック写真が深度のすべて** — シャドウ不要。写真の照明 + 主体が立体感を担う
- **スペック数値 80px/700** — テクニカルフィジカリティの visual climax
