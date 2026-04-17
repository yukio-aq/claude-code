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
├── instincts/      自動抽出・手動記録されたパターン（精査前）
│   └── .last-run   差分処理用マーカー（extract.js が自動管理）
└── curated/        手動で精査・昇格させたベストプラクティス
    ├── patterns.md      確認済みの良いパターン
    └── anti-patterns.md 確認済みのアンチパターン
```

## 知識蓄積のサイクル

```
実装中に気づいたこと
    ↓ /learn <内容>
instincts/ に即時記録
    ↓
    ─────────────────────────────────
    ↓ /save（作業の区切りごと）
セッションサマリーを .claude/sessions/ に保存
    ↓ extract.js が自動実行（差分のみ処理）
instincts/ にパターンを追記
    ─────────────────────────────────
    ↓ /curate（定期的に実行）
instincts/ を精査・ノイズを除去
    ↓
curated/ に昇格（エージェントが実装・レビュー時に参照）
```

## コマンド

| コマンド | 用途 |
|---|---|
| `/learn <内容>` | 気づきをその場で instincts/ に記録 |
| `/save` | セッションを保存 + extract.js を実行 |
| `/curate` | instincts/ を精査して curated/ に昇格 |

## instincts/ vs curated/ の違い

| | instincts/ | curated/ |
|---|---|---|
| 入力元 | extract.js（自動）/ `/learn`（手動） | `/curate` コマンドで手動昇格 |
| 品質 | 未精査・ノイズ含む | 精査済み・コード例付き |
| エージェント参照 | しない | する（実装・レビュー時） |

## curated/ へ昇格するパターンの基準

- 具体的なコードに落とせるもの
- 複数プロジェクトに適用できる汎用性があるもの
- 「適用すべきでないケース」まで書けるもの

**instincts の大半はノイズ。** 10件あれば昇格に値するのは1〜2件が相場。
厳しくフィルタして curated/ の品質を維持すること。

## 参照しているエージェント

curated/ は以下のエージェントが実装・レビュー前に参照する:
- `frontend-implementer`
- `backend-implementer`
- `frontend-reviewer`
- `backend-reviewer`
