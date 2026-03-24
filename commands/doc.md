---
description: 技術ドキュメント・オンボーディング資料・APIリファレンスを生成・更新する。doc-writerエージェントを起動して作成する。
---

# /doc

技術ドキュメント・オンボーディング資料・APIリファレンスを生成・更新する。

## 使い方
/doc                          # 変更されたファイルに関連するドキュメントを更新
/doc onboarding               # オンボーディングガイドを生成・更新
/doc api <ファイルパス>       # APIリファレンスを生成
/doc jsdoc <ファイルパス>     # JSDoc / docstring を補完

## 例
/doc
/doc onboarding
/doc api src/routes/users.ts
/doc jsdoc src/lib/date-utils.ts

## 実行内容

### 引数なし
1. `git diff HEAD` で変更ファイルを確認する
2. 関連ドキュメントを特定して `doc-writer` で更新する
3. 更新ファイルの一覧を報告する

### onboarding
以下を生成・更新する:
- README.md
- docs/architecture.md
- docs/getting-started.md
- docs/conventions.md

### api <パス>
- エンドポイント一覧（パス / メソッド / 説明）
- リクエスト / レスポンススキーマ
- エラーコード一覧・使用例

### jsdoc <パス>
- 公開関数・クラスに JSDoc / docstring を補完する
- 既存コメントがある場合は確認してから更新する

## 保存先
```
docs/
├── adr/                ← /adr が管理
├── plans/              ← /plan が管理
├── test-strategies/    ← /test が管理
├── api-reference.md
├── architecture.md
├── getting-started.md
└── conventions.md
```