---
description: セッションから学習した知識を蓄積する仕組み。使えば使うほどプロジェクト固有の知識が溜まっていく。
---

# continuous-learning/

セッションから学習した知識を蓄積する仕組み。

## ディレクトリ構成

```
skills/continuous-learning/
├── README.md       このファイル
├── extract.js      セッションからパターンを抽出するスクリプト
├── instincts/      自動抽出されたパターン（編集しない）
└── curated/        手動で精査・昇格させたベストプラクティス
    ├── patterns.md
    └── anti-patterns.md
```

## 仕組み

```
セッション終了（Stop hook）
    ↓
session-save.js が .claude/sessions/ に保存
    ↓
node skills/continuous-learning/extract.js を実行（手動）
    ↓
instincts/ にパターンを自動保存
    ↓
内容を確認して curated/ に昇格（手動）
    ↓
エージェントが次回から参照して品質向上
```

## パターン抽出の実行

```bash
# プロジェクトのセッションからパターンを抽出する
node ~/desktop/claude-code/skills/continuous-learning/extract.js
```

## instinct ファイルのフォーマット

```markdown
---
title: Zodバリデーションは必ずスキーマを分離する
confidence: 0.85
source_sessions: 3
last_seen: 2026-03-22
---

## パターン
APIエンドポイントのバリデーションはインラインで書かず、
schemas/ ディレクトリに分離したZodスキーマを使う。

## 根拠
3回のセッションで同じ修正が発生。

## 適用例
src/schemas/user.schema.ts にスキーマを定義して routes/ でimport。

## アンチパターン
route handler の中に z.object({ ... }) を直接書く。
```

## curated/ への昇格ルール

instincts/ に自動保存されたファイルを確認して、
「これは確かに自分のパターンだ」と思ったものだけ curated/ に移す。

移すときに追記すること:
- 具体的なコード例
- アンチパターンの例
- 適用すべきでないケース（過剰適用を防ぐ）

curated/ に入ったものはエージェントが自動参照して
実装・レビューの質が上がっていく。