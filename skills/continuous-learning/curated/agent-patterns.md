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

### pgvector のテーブルをモデル変更後にそのまま使う

**問題:** pgvector の埋め込みテーブルは作成時に次元数（embed_dim）が固定される。埋め込みモデルを変更して次元数が変わったとき、テーブルを作り直さずに使い続けると次元不一致エラーになる。

**発生状況:** 埋め込みモデルを `text-embedding-004`（768次元）から `gemini-embedding-001`（3072次元）などに切り替えたとき。

**悪い例:**
```python
# NG: モデル変更後もテーブルをそのまま使う → 次元不一致エラー
# エラー例: "expected 768 dimensions, got 3072"
vector_store = PGVectorStore.from_params(
    embed_dim=3072,  # モデル変更 → テーブルの embed_dim と不一致
    ...
)
```

**良い例:**
```python
# OK: モデル変更時はテーブルを再作成してから使う
# LlamaIndex は DROP 後に自動再作成する
conn.execute("DROP TABLE IF EXISTS public.data_my_collection")

vector_store = PGVectorStore.from_params(
    embed_dim=3072,  # テーブルが存在しないので正しい次元で再作成される
    ...
)
```

**根拠:** pgvector の vector カラムは型宣言で次元数を持つ（`vector(768)`）。ALTER TABLE での次元変更はできないため、モデル変更 → 次元変更が伴う場合は DROP + 再作成が必須。インデックスも再構築される。

---

### ローカルファイル永続化の ChromaDB をコンテナ環境に使う

**問題:** ChromaDB のローカルファイル永続化モードはコンテナ（ECS・Cloud Run 等）では再起動のたびにデータが消失する。開発中に気づかず本番デプロイ後に発覚すると移行コストが高い。

**発生状況:** RAG パイプラインのベクターストアとして ChromaDB を選定し、そのままコンテナデプロイしたとき。

**悪い例:**
```python
# NG: ローカルファイル永続化 → コンテナ再起動でデータ消失
import chromadb

client = chromadb.PersistentClient(path="./chroma_db")  # ECS では再起動のたびに消える
```

**良い例:**
```python
# OK: 最初から pgvector on RDS を使う
# LlamaIndex の上位 API は同じ → 差し替えコストは接続設定のみ
from llama_index.vector_stores.postgres import PGVectorStore

vector_store = PGVectorStore.from_params(
    host=os.environ["DB_HOST"],
    port=5432,
    database=os.environ["DB_NAME"],
    table_name="embeddings",
    embed_dim=768,
)
```

**根拠:** コンテナはステートレスで再起動時にローカルファイルが消える。EFS/EBS のマウントで永続化も可能だが、pgvector on RDS のほうがバックアップ・レプリケーション・監視が整っており運用コストが低い。移行は `llama-index-vector-stores-postgres` への差し替えだけで済む。

---

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
