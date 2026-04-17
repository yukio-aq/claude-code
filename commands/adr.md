---
description: 技術選定や設計上の重要な決定をADR（Architecture Decision Record）として記録する。architectエージェントを起動してトレードオフを分析し、docs/adr/に保存する。
---

# /adr

技術選定や設計上の重要な決定をADRとして記録する。

## 使い方
/adr <決定したいこと>
/adr list

## 例
/adr 全文検索にElasticsearchとPGroongaどちらを使うか
/adr WebSocketとSSEの選定
/adr list

## 実行内容

### 内容を渡した場合
1. `architect` エージェントを起動する
2. Tavilyで各選択肢の最新情報・実績・既知の問題を調べる
3. トレードオフを分析して推奨案を提示する
4. `docs/adr/ADR-<番号>-<タイトル>.md` に保存する
5. `adr-reviewer` でレビュー → 結果を末尾に追記
6. APPROVED なら確定 / NEEDS_REVISION なら指摘箇所を修正して再保存

### list の場合
`docs/adr/` 配下のADR一覧を番号・タイトル・Statusで表示する。

## 保存フォーマット

```markdown
# ADR-XXX: <タイトル>

| 項目 | 内容 |
|---|---|
| Status | Proposed / Accepted / Deprecated |
| Date | YYYY-MM-DD |
| Review Date | YYYY-MM-DD |

## Context
## Options（各選択肢のメリット・デメリット）
## Decision
## Consequences
```

## 保存先
`docs/adr/ADR-<番号>-<タイトル>.md`