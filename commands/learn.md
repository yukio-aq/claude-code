---
description: 気づいたパターン・アンチパターンを即座に instincts/ に記録する。セッション終了を待たずに学びをリアルタイムで蓄積する。
---

# /learn

気づきや知見を `skills/continuous-learning/instincts/` に即座に記録する。

## 使い方
```
/learn <記録したい内容>
```

例:
- `/learn Zodスキーマはroute内にインラインで書かず schemas/ に分離する`
- `/learn N+1はselect_relatedで解決する。prefetch_relatedは逆参照に使う`
- `/learn Docker Composeのvolumesでnode_modulesをバインドすると激遅になる`

## 実行手順

**Step 1**: `$ARGUMENTS` が空の場合は「何を記録しますか？」と聞いて終了する。

**Step 2**: `$ARGUMENTS` の内容からカテゴリを判定する。

| キーワード | カテゴリ |
|---|---|
| テスト・test・vitest・jest・playwright・カバレッジ | `testing` |
| API・エンドポイント・endpoint・レスポンス・スキーマ・Zod | `api-design` |
| アーキテクチャ・設計・レイヤー・layer・分割・責務 | `architecture` |
| セキュリティ・認証・認可・auth・token・JWT | `security` |
| パフォーマンス・最適化・N+1・キャッシュ・cache・遅い | `performance` |
| コミット・commit・ブランチ・branch・PR・マージ | `git` |
| エージェント・agent・LLM・プロンプト・Mastra・LangChain | `ai-agent` |
| 上記に該当しない | `general` |

**Step 3**: Bash でファイルパスを確定する。

```bash
INSTINCTS_DIR=~/desktop/claude-code/skills/continuous-learning/instincts
mkdir -p "$INSTINCTS_DIR"
TODAY=$(date +%Y-%m-%d)
CATEGORY=<Step 2で判定したカテゴリ>
FILEPATH="$INSTINCTS_DIR/${TODAY}-${CATEGORY}.md"
echo "FILEPATH=$FILEPATH"
[ -f "$FILEPATH" ] && echo "EXISTS=true" || echo "EXISTS=false"
```

**Step 4**: ファイルへの書き込み。

- ファイルが**存在する場合**: Read ツールで既存内容を読み込み、`## パターン` セクションの末尾に `- $ARGUMENTS` を1行追記してから Write で保存する。
- ファイルが**存在しない場合**: Write ツールで以下のフォーマットで新規作成する。

```markdown
---
title: {CATEGORY} パターン
confidence: 0.8
source_sessions: 1
last_seen: {TODAY}
---

## パターン

- {$ARGUMENTS}

## 根拠

/learn コマンドで手動記録。確かなパターンだけ curated/ に昇格させてください。
```

**Step 5**: 完了を報告する。

```
✅ 記録しました
カテゴリ: {CATEGORY}
ファイル: instincts/{TODAY}-{CATEGORY}.md
内容: {$ARGUMENTS}
```
