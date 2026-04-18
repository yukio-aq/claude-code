---
description: コードレビューを実行する。ファイルの拡張子・パスから領域を自動判定して対応するレビュアーを起動する。
---

# /review

コードレビューを実行する。
領域はファイルパスと拡張子から自動判定する。

## 使い方
/review                   # ステージング中の変更をレビュー
/review <ファイルパス>     # 特定ファイル・ディレクトリをレビュー

## 例
/review
/review src/api/users.ts
/review src/components/
/review ios/Sources/Auth/

## 実行内容

### Step 1: 対象ファイルの特定
- 引数なし → `git diff --staged` の変更ファイルを対象
- パス指定 → そのファイル・ディレクトリを対象

### Step 2: 領域の自動判定
判定できない場合は確認する。

| 判定条件 | レビュアー |
|---|---|
| *.test.ts/tsx / *.spec.ts/tsx / __tests__/ | qa-reviewer（実装レビューモード） |
| docs/test-strategies/*.md | qa-reviewer（戦略書レビューモード） |
| .tsx .ts + components/ pages/ app/ | frontend-reviewer |
| .ts .js + api/ routes/ server/ services/ | backend-reviewer |
| migrations/ schema/ repository/ | database-reviewer |
| .swift / .xcodeproj | ios-reviewer |
| .kt / build.gradle | android-reviewer |
| three / r3f / .unity / .cs | 3d-reviewer |
| mastra / langchain / agent/ | ai-agent-reviewer |
| `--security` オプション指定時 | security-auditor（全ファイル横断） |

### Step 3: レビュアーを起動
複数領域にまたがる場合は該当レビュアーを並列起動する。

## 出力形式

```
| 重大度   | 件数 | 判定 |
|----------|------|------|
| CRITICAL |  0   |  ✅  |
| HIGH     |  1   |  ⚠️  |
| MEDIUM   |  2   |  ℹ️  |
| LOW      |  0   |  —   |

Verdict: WARNING — HIGH を解消してからコミット
```