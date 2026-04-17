---
description: 機能・タスクの実装計画を作成する。planner / architect / qa-engineer を連携させて計画からテスト戦略まで一気に作る。
---

# /plan

機能・タスクの実装計画を作成する。

## 使い方
/plan <機能の説明>

## 例
/plan ユーザー認証機能をJWTで実装する
/plan 全文検索エンジンの選定と実装
/plan 決済フローにStripeを組み込む

## 実行内容

1. `planner` エージェントでタスク分解・依存整理・フェーズ分けを行う
2. 技術選定が必要と判断した場合は `architect` も起動してADRを作成する
3. `qa-engineer` でテスト戦略を追記する
4. 複数領域にまたがる場合は `chief-of-staff` を先に通す
5. 計画を `docs/plans/YYYY-MM-DD-<feature>.md` に保存する
6. `plan-reviewer` でレビュー → 結果を末尾に追記
7. APPROVED なら実装開始を案内 / NEEDS_REVISION なら停止

## 出力形式
- フェーズ分け（依存順）
- 各タスク（担当領域 / 工数感 / リスク）
- 並列実行できるタスク
- 前提確認事項

## 次のステップ

レビューが APPROVED になったら `*-implementer` で実装を開始します。
NEEDS_REVISION の場合は指摘事項を修正してから実装に進んでください。