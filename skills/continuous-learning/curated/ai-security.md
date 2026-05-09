# AI / セキュリティ — パターン & アンチパターン

LLM バックエンド・プロンプト設計・セキュリティに関するパターン。
ai-agent-implementer / ai-agent-reviewer / backend-reviewer / security-auditor が参照する。

---

## アンチパターン

### ユーザー入力を `json.dumps` で LLM プロンプトに直接埋め込む

**問題:** `dict[str, Any]` のような無制約の入力を `json.dumps` でそのままプロンプトに差し込むと、攻撃者が悪意あるプロンプトを注入できる（プロンプトインジェクション）。

**発生状況:** LLM バックエンドで、フォームや API から受け取ったコンテキスト情報をそのままプロンプトテンプレートに埋め込むとき。

**悪い例:**
```python
# NG: context の内容がフィルタなしにプロンプトへ混入する
def build_prompt(context: dict[str, Any]) -> str:
    return f"Answer based on: {json.dumps(context)}"
```

**良い例:**
```python
# OK: キーホワイトリスト + 値長制限でサニタイズしてから埋め込む
ALLOWED_KEYS = {"name", "department", "role"}
MAX_VALUE_LEN = 200

def _sanitize_context(context: dict[str, Any]) -> dict[str, str]:
    return {
        k: str(v)[:MAX_VALUE_LEN]
        for k, v in context.items()
        if k in ALLOWED_KEYS
    }

def build_prompt(context: dict[str, Any]) -> str:
    safe = _sanitize_context(context)
    return f"Answer based on: {json.dumps(safe)}"
```

**根拠:** LLM はプロンプト内の全テキストを命令として解釈する。ユーザー入力がフィルタなしで混入すると「前の指示を無視して…」等の悪意ある命令が実行される。キーホワイトリストで想定外フィールドをドロップし、値長制限で長大な注入を防ぐ。

---
