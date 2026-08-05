---
description: RFP・要件メモなどを分析し、開発工数・費用見積もり・クライアント向け提案書ドラフトを作成する。proposal-estimatorエージェントを起動する。
---

# /estimate

proposal-estimator エージェントを起動し、開発工数・費用の見積もりと提案書ドラフトの作成を行う。

## 使い方

```
/estimate
/estimate <RFPファイルパス>
/estimate --draft-only
```

## オプション

| オプション | 説明 |
|---|---|
| （なし） | 対象ドキュメントをインタラクティブに確認してから開始 |
| `<ファイルパス>` | 指定したRFP・要件資料を直接読み込んで分析を開始 |
| `--draft-only` | 単価未確定のまま工数見積もりまでを先に出す（費用は保留） |

## 実行内容

```
1. proposal-estimator を起動
2. RFP・要件資料を読み込みスコープを抽出
3. 単価・体制・バッファ率・契約形態をヒアリング（--draft-only の場合は工数までで一旦停止）
4. WBSレベルでタスク分解し工数を見積もり
5. 費用を見積もり、リスク・前提条件を明記
6. docs/proposals/ に見積もり書・提案書ドラフトを出力
```

## 出力先

- `docs/proposals/{案件名}-estimate-YYYY-MM-DD.md`
- `docs/proposals/{案件名}-proposal-YYYY-MM-DD.md`

## 次のステップ

提案が承認されたら `/requirements` で要件定義に進む。
技術選定が必要な場合は `/adr` を検討する。
