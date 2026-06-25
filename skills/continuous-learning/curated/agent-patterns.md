---
last_updated: 2026-06-19
confidence: medium
review_after: 2026-12-19
---

# LLM エージェント設計 — パターン & アンチパターン

AIエージェント・ワークフロー・ツール定義に関する汎用パターン。言語・フレームワーク非依存。
ai-agent-implementer / ai-agent-reviewer / ai-agent-designer が参照する。

## パターン

### 空クエリを外部 AI API に送る前に早期リターンする

**概要:** 埋め込みモデルや LLM API を呼び出す前に、クエリが空文字であることを確認して早期リターンする。

**適用条件:** ユーザー入力・LLM 生成テキストをそのまま埋め込みモデルや検索 API に渡すとき。

**良い例:**
```python
# OK: 空クエリを API に送らない
async def search(query: str) -> list[dict]:
    if not query.strip():
        return []  # 空なら API を呼ばない
    return await embedding_client.search(query)
```

**アンチパターン:**
```python
# NG: 空クエリで API を呼ぶ → 無駄なコスト・レイテンシが発生
async def search(query: str) -> list[dict]:
    return await embedding_client.search(query)  # query="" でもリクエストが走る
```

**適用すべきでないケース:** 空クエリを「全件取得」として扱う API 仕様の場合はスキップしてよい。

---

## アンチパターン

### LLM 出力の型バリエーションにサニタイズを適用しない

**問題:** LLM が `suggestions` を `list[str]` で返すケースと `list[dict]` で返すケースが混在するとき、dict 専用のサニタイズ関数だけを実装すると、文字列ケースで長さ制限・バリデーションが機能しない抜け穴になる。

**発生状況:** LLM のレスポンス形式がモデル・プロンプトバリアントによって揺れる RAG パイプラインやサジェスト生成処理。

**悪い例:**
```python
# NG: dict ケースのみサニタイズ → str ケースは制限なしで通過
def sanitize_suggestion(s) -> dict:
    if isinstance(s, dict):
        return {"label": s["label"][:500], "value": s["value"][:500]}
    return {"label": s, "value": s}  # str ケースは長さ制限なし
```

**良い例:**
```python
# OK: str / dict 両ケースで同じ上限を適用してから正規化
MAX_LEN = 500

def sanitize_suggestion(s) -> dict:
    if isinstance(s, dict):
        return {
            "label": str(s.get("label", ""))[:MAX_LEN],
            "value": str(s.get("value", ""))[:MAX_LEN],
        }
    # str ケースも同じ上限で切り詰めてから正規化
    text = str(s)[:MAX_LEN]
    return {"label": text, "value": text}
```

**根拠:** LLM の出力形式は実行時まで確定しない。型チェックを分岐させても、各分岐で同等のバリデーションを適用しないと片方が抜け穴になる。型ごとの分岐とは独立して、すべての出力値に同じ制約を適用する設計にする。

---
