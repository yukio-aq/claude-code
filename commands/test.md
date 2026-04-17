---
description: テスト戦略の設計・レビュー・実装を行う。設計→レビュー→実装の3フェーズで進める。
---

# /test

テスト戦略の設計・レビュー・テストコードの実装・カバレッジ補完を行う。

## 使い方
```
/test <機能名>           # Phase 1+2: 設計 → レビュー → 停止（ユーザー確認待ち）
/test <戦略書パス>       # Phase 3: 承認済み戦略書に従って実装
/test                    # カバレッジを計測して不足を補完
```

## 例
```
/test ユーザー認証
/test docs/test-strategies/user-auth.md
/test
```

---

## Phase 1+2: 設計 → レビュー（機能名を渡した場合）

### Step 1: qa-engineer でテスト戦略を設計する

`qa-engineer` エージェントに以下を依頼する:
- テストピラミッド（Unit / Integration / E2E）の振り分け
- テストケース一覧（命名規則: `should <動作> when <条件>`）
- カバレッジ基準（rules/testing.md 準拠）
- モック方針・使用フレームワーク

### Step 2: 戦略書を保存する

保存先: `docs/test-strategies/<feature-name>.md`

フォーマット:
```markdown
# テスト戦略: {機能名}

> 作成日: {日付}
> 対象: {ファイル・モジュール}
> フレームワーク: {Vitest / pytest / XCTest 等}

## カバレッジ目標
| 対象 | 目標 |
|------|------|
| {対象} | {%}以上 |

## テストピラミッド

### Unit テスト
- `should ... when ...`
- `should ... when ...`

### Integration テスト
- `should ... when ...`

### E2E テスト（クリティカルフローのみ）
- `should ... when ...`

## モック方針
{外部依存・モック対象の説明}
```

### Step 3: qa-reviewer でレビューする

`qa-reviewer` エージェントに戦略書を渡してレビューさせる。
レビュー結果は戦略書末尾に追記される。

### Step 4: 停止してユーザーに確認を促す

以下のメッセージを出力して終了する:

```
📋 テスト戦略書を保存しました: docs/test-strategies/<feature>.md

qa-reviewer のレビュー結果を確認してください。
- APPROVED: `/test docs/test-strategies/<feature>.md` で実装を開始
- NEEDS_REVISION: 戦略書を修正してから再度 `/test <戦略書パス>` で実装
```

---

## Phase 3: 実装（戦略書パスを渡した場合）

### Step 1: 戦略書を読み込む

指定された `docs/test-strategies/<feature>.md` を Read する。
`qa-reviewer` の判定が `APPROVED` であることを確認する。
`NEEDS_REVISION` の場合はその旨を伝えて停止する。

### Step 2: test-implementer で実装する

`test-implementer` エージェントに戦略書を渡して実装を依頼する:
- 戦略書のテストケースをすべて実装する
- 🔴 Red → 🟢 Green のサイクルを記録しながら進める
- テスト実行して全件グリーンを確認する

### Step 3: カバレッジを計測して確認する

テストを実行してカバレッジレポートを出力する。
`rules/testing.md` の基準値と照合して合否を報告する。

### Step 4: qa-reviewer で実装レビューを行う

`qa-reviewer` に実装済みのテストファイルを渡してレビューさせる。
戦略書との drift・偽陽性・テスト独立性・AAA構造・モック品質を確認する。

- **APPROVED**: 完了を報告する
- **NEEDS_REVISION**: 指摘箇所を修正して再度テストを実行し、APPROVED になるまで繰り返す

---

## 引数なし: カバレッジ補完

1. テストを実行してカバレッジを計測する
2. `rules/testing.md` の基準値を下回る箇所を特定する
3. `test-implementer` で不足テストを補完する
4. 再計測して基準値クリアを確認する
