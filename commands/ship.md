---
description: コミット前チェックからPR作成まで一連のフローを実行する。フォーマット・型チェック・テスト・レビューをすべて通してからコミット・pushする。
---

# /ship

コミット前チェックを実行し、PRを作成する一連のフローを実行する。

## 使い方
/ship

## 実行内容

### Step 1: ステージング確認
`git diff --staged` で変更内容を表示する。
ステージングが空なら `git add` を案内して終了する。
main / master ブランチなら直接コミットを拒否する。

### Step 2: 自動チェック
以下をすべて実行する。失敗した場合は修正してから再実行する。

```bash
prettier --check .
tsc --noEmit
bun test --passWithNoTests
```

### Step 3: コードレビュー
`/review` と同じロジックで領域を判定してレビュアーを起動する。
CRITICAL / HIGH があれば差し戻す（Step 4以降に進まない）。

### Step 4: コミットメッセージ生成
変更内容から Conventional Commits 形式で自動生成する。
確認を求めてから `git commit` を実行する。

### Step 5: PR description生成・push
`pr-author` エージェントを起動してdescriptionを生成する。
確認後に `git push -u origin <branch>` を実行する。

## 注意
- main / master への直接pushは絶対に拒否する
- `git push --force` は使わない