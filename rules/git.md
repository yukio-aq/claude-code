---
description: Gitワークフロールール。ブランチ戦略・コミット規約・PRルール。
---

# Gitワークフロールール

## ブランチ戦略

```
main          ← 本番。直接pushは禁止
develop       ← 統合ブランチ（チーム開発時）
feat/xxx      ← 新機能
fix/xxx       ← バグ修正
refactor/xxx  ← リファクタリング
chore/xxx     ← 設定・依存関係
docs/xxx      ← ドキュメントのみ
```

- `main` へのコミットは必ずPR経由
- ブランチ名はケバブケース（例: `feat/user-authentication`）
- 作業ブランチは `main` または `develop` から切る

## コミット規約（Conventional Commits）

```
<type>: <description>

feat     新機能
fix      バグ修正
refactor リファクタリング（機能変更なし）
test     テスト追加・修正
docs     ドキュメントのみ
chore    ビルド・設定・依存関係
perf     パフォーマンス改善
ci       CI/CD設定
```

## コミットの粒度

- 1コミット1つの論理的変更
- テストと実装は同じコミットに含める
- フォーマット修正は別コミットにする
- `WIP` コミットはPRマージ前にsquashする

## PRルール

### タイトル
Conventional Commits形式と同じ（例: `feat: add user authentication`）

### description必須項目
- 変更の背景・理由
- 変更内容のチェックリスト
- テスト方法
- 破壊的変更の有無

### レビュー
- セルフレビュー（`*-reviewer` エージェント）を通してからレビュー依頼
- CRITICAL / HIGH の指摘は必ず解消してからマージ
- UIの変更があるときはスクリーンショット必須

### マージ戦略
- `feat` / `fix` → Squash merge
- `release` / `hotfix` → Merge commit
- Rebaseは原則使わない

## やってはいけないこと

- `main` へ直接 push しない
- `git push --force` は共有ブランチで使わない（`--force-with-lease` を使う）
- 500行超の巨大コミットは分割する
- 無関係な変更を1つのPRに混ぜない