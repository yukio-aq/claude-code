requirements-analyst エージェントを起動して、要件の精査・構造化・要件定義書の作成を行います。

## 使い方

```
/requirements
/requirements --agile
/requirements --waterfall
/requirements --ai
/requirements --review [ファイルパス]
```

## オプション

| オプション | 説明 |
|---|---|
| （なし） | エージェントが案件タイプを確認してから開始 |
| `--agile` | Agileスタイル（ユーザーストーリー + MoSCoW）で直接開始 |
| `--waterfall` | ウォーターフォールスタイル（SRS形式）で直接開始 |
| `--ai` | AI・エージェントアプリ固有の要件も含めて整理 |
| `--review [path]` | 既存の要件ドキュメントをレビューして品質チェック |

## 実行内容

```
1. requirements-analyst を起動
2. 案件タイプに応じた要件定義フレームワークを適用
3. 曖昧さ・矛盾・見落としを検出してヒアリング
4. 機能要件 / 非機能要件を構造化
5. docs/requirements/ に要件定義書を出力
6. planner に渡すための概要サマリーを作成
```

## 出力先

- `docs/requirements/user-stories-YYYY-MM-DD.md`（Agile）
- `docs/requirements/SRS-YYYY-MM-DD.md`（ウォーターフォール）
- `docs/requirements/ai-requirements-YYYY-MM-DD.md`（AI/エージェント）

## 次のステップ

要件定義書が完成したら `/plan` で実装計画を作成します。
