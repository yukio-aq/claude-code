---
name: llamaindex
description: >
  LlamaIndex Python v0.14.x の RAG・Agent・Workflow 実装パターン。
  ai-agent-implementer / ai-agent-reviewer / backend-implementer が
  LlamaIndex アプリケーションを実装・レビューするときに参照する。
---

# LlamaIndex Python v0.14.x — 実装スキル

> 公式ドキュメント: https://developers.llamaindex.ai/python/framework/
> GitHub: https://github.com/run-llama/llama_index
> Python 要件: >=3.10, <4.0 / ライセンス: MIT

---

## インストール

```bash
# フルパッケージ（推奨: プロトタイプ・小規模プロジェクト）
pip install llama-index

# コアのみ（本番: 必要なパッケージだけ追加する）
pip install llama-index-core

# LLM プロバイダー（必要なものを選択）
pip install llama-index-llms-openai
pip install llama-index-llms-anthropic
pip install llama-index-llms-ollama

# Embedding モデル
pip install llama-index-embeddings-openai
pip install llama-index-embeddings-huggingface

# ベクトルストア
pip install llama-index-vector-stores-chroma
pip install llama-index-vector-stores-pinecone
pip install llama-index-vector-stores-qdrant

# Observability
pip install llama-index-observability-otel
```

---

## Settings（グローバル設定）

`Settings` はシングルトン。コンポーネントが個別指定されない場合のデフォルト。

```python
from llama_index.core import Settings
from llama_index.core.node_parser import SentenceSplitter
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding

Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0.1)
Settings.embed_model = OpenAIEmbedding(
    model="text-embedding-3-small", embed_batch_size=100
)
Settings.text_splitter = SentenceSplitter(chunk_size=1024, chunk_overlap=20)
```

### ローカルオーバーライド（個別指定が Settings より優先される）

```python
index = VectorStoreIndex.from_documents(
    documents,
    embed_model=OpenAIEmbedding(model="text-embedding-3-large"),
)
query_engine = index.as_query_engine(llm=OpenAI(model="gpt-4o"))
```

### ローカル LLM（Ollama）

```python
from llama_index.llms.ollama import Ollama
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

Settings.llm = Ollama(model="llama3.1", request_timeout=360.0)
Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-base-en-v1.5")
```

---

## RAG パイプライン（5行で始める）

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader

documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()
response = query_engine.query("What is this document about?")
```

---

## データ読み込み

### SimpleDirectoryReader

```python
from llama_index.core import SimpleDirectoryReader

# 基本
documents = SimpleDirectoryReader("data").load_data()

# 再帰 + 拡張子フィルタ + 並列
documents = SimpleDirectoryReader(
    "data", recursive=True, required_exts=[".pdf", ".md"]
).load_data(num_workers=4)

# カスタムメタデータ
documents = SimpleDirectoryReader(
    "data",
    file_metadata=lambda path: {"source": path},
).load_data()
```

**対応形式**: `.csv`, `.docx`, `.epub`, `.ipynb`, `.md`, `.pdf`, `.png`, `.jpg`, `.pptx` 等

### Document の手動作成

```python
from llama_index.core import Document

doc = Document(
    text="LlamaIndex is a data framework for LLM applications.",
    metadata={"filename": "intro.txt", "category": "docs"},
)
# メタデータの制御
doc.excluded_llm_metadata_keys = ["filename"]
doc.excluded_embed_metadata_keys = ["filename"]
```

---

## Node Parser（テキスト分割）

| パーサー | 用途 |
|---|---|
| **SentenceSplitter** | 汎用。最初に試すべきデフォルト |
| **TokenTextSplitter** | トークン数を厳密に制御したい場合 |
| **SentenceWindowNodeParser** | 精密検索 + コンテキスト復元 |
| **SemanticSplitterNodeParser** | 意味的に関連するテキストをまとめる |
| **HierarchicalNodeParser** | 大規模文書の階層的検索 |
| **CodeSplitter** | ソースコード |
| **MarkdownNodeParser** | Markdown 構造を保持 |

```python
from llama_index.core.node_parser import SentenceSplitter

splitter = SentenceSplitter(chunk_size=512, chunk_overlap=50)
nodes = splitter.get_nodes_from_documents(documents)
```

---

## Ingestion Pipeline

```python
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.extractors import TitleExtractor
from llama_index.embeddings.openai import OpenAIEmbedding

pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512, chunk_overlap=20),
        TitleExtractor(),
        OpenAIEmbedding(),
    ]
)
nodes = pipeline.run(documents=documents, num_workers=4)

# キャッシュの永続化（同一データの再処理をスキップ）
pipeline.persist("./pipeline_storage")
```

---

## Index の種類と使い分け

| Index | 構築コスト | クエリコスト | 最適用途 |
|---|---|---|---|
| **VectorStoreIndex** | 埋め込み生成 | 低い | セマンティック検索（**デフォルト選択**） |
| **SummaryIndex** | 無料 | 高い（全ノード処理） | 文書全体の要約 |
| **TreeIndex** | 中程度 | 中程度 | 階層的データの検索 |
| **KeywordTableIndex** | キーワード抽出 | 低い | キーワード検索 |
| **PropertyGraphIndex** | LLM抽出 | 中程度 | エンティティ関係の活用 |

### VectorStoreIndex（最も一般的）

```python
from llama_index.core import VectorStoreIndex

index = VectorStoreIndex.from_documents(documents)

# 永続化
index.storage_context.persist("storage")

# 復元
from llama_index.core import StorageContext, load_index_from_storage
storage_context = StorageContext.from_defaults(persist_dir="storage")
index = load_index_from_storage(storage_context)
```

### 外部ベクトルストア（Chroma 例）

```python
import chromadb
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.core import VectorStoreIndex, StorageContext

chroma_client = chromadb.PersistentClient("./chroma_db")
collection = chroma_client.create_collection("my_collection")
vector_store = ChromaVectorStore(chroma_collection=collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

# 既存ストアからの復元
index = VectorStoreIndex.from_vector_store(vector_store)
```

### 外部ベクトルストア（Qdrant 例）

```python
import qdrant_client
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core import VectorStoreIndex, StorageContext

client = qdrant_client.QdrantClient(location=":memory:")  # 本番: host指定
vector_store = QdrantVectorStore(client=client, collection_name="my_collection")
storage_context = StorageContext.from_defaults(vector_store=vector_store)

index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)
```

---

## QueryEngine（単発の質問応答）

3段階: Retrieval → Postprocessing → Response Synthesis

```python
# 高レベル API
query_engine = index.as_query_engine(
    similarity_top_k=5,
    response_mode="compact",
)
response = query_engine.query("What is LlamaIndex?")
```

### Response Synthesis モード

| モード | 動作 | 用途 |
|---|---|---|
| `compact` | 複数 Node を詰め込み LLM 呼び出し最小化 | **デフォルト。一般的な Q&A** |
| `refine` | Node を順次処理し回答を段階的に精緻化 | 高品質だが LLM 呼び出し多い |
| `tree_summarize` | 再帰的にツリー構築して要約 | 要約タスク |
| `no_text` | LLM 呼び出しなし。検索のみ | デバッグ・検索結果確認 |
| `accumulate` | 各チャンクに個別クエリ | チャンクごとの回答が必要 |

### カスタム RetrieverQueryEngine

```python
from llama_index.core import get_response_synthesizer
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.postprocessor import SimilarityPostprocessor

retriever = VectorIndexRetriever(index=index, similarity_top_k=5)
response_synthesizer = get_response_synthesizer(response_mode="compact")

query_engine = RetrieverQueryEngine(
    retriever=retriever,
    response_synthesizer=response_synthesizer,
    node_postprocessors=[SimilarityPostprocessor(similarity_cutoff=0.7)],
)
```

### ストリーミング

```python
query_engine = index.as_query_engine(streaming=True)
streaming_response = query_engine.query("What is LlamaIndex?")
for text in streaming_response.response_gen:
    print(text, end="", flush=True)
```

---

## ChatEngine（会話型インターフェース）

QueryEngine のステートフル版。会話履歴を保持する。

```python
chat_engine = index.as_chat_engine(chat_mode="condense_plus_context")
response = chat_engine.chat("Tell me about LlamaIndex.")
response = chat_engine.chat("Can you elaborate?")  # 会話を覚えている
chat_engine.reset()
```

### Chat モード

| モード | 動作 |
|---|---|
| `condense_plus_context` | 質問書き換え + コンテキスト注入（**推奨**） |
| `condense_question` | 会話履歴でクエリを書き換え |
| `context` | 毎回 Index から Node 取得してシステムプロンプトに注入 |
| `best` | LLM に応じて ReAct or OpenAI エージェントを自動選択 |
| `simple` | LLM と直接会話（インデックス検索なし） |

### ストリーミング

```python
streaming_response = chat_engine.stream_chat("Tell me a joke.")
for token in streaming_response.response_gen:
    print(token, end="")

# 非同期
streaming_response = await chat_engine.astream_chat("Tell me a joke.")
async for token in streaming_response.async_response_gen():
    print(token, end="")
```

---

## Agent

### エージェントの種類

| Agent | 説明 | 選択基準 |
|---|---|---|
| **FunctionAgent** | Function Calling ベース | **デフォルト選択。OpenAI/Anthropic/Gemini 向け** |
| **ReActAgent** | ReAct プロンプティング | Function Calling 非対応の LLM 向け |
| **CodeActAgent** | Python コード生成で実行 | 複雑な動的ワークフロー |
| **AgentWorkflow** | マルチエージェントオーケストレーター | 複数エージェントの協調 |

### FunctionAgent（基本）

```python
import asyncio
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.llms.openai import OpenAI

def multiply(a: float, b: float) -> float:
    """Multiply two numbers and returns the product."""
    return a * b

def add(a: float, b: float) -> float:
    """Add two numbers and returns the sum."""
    return a + b

agent = FunctionAgent(
    tools=[multiply, add],
    llm=OpenAI(model="gpt-4o-mini"),
    system_prompt="You are a math assistant.",
)

async def main():
    response = await agent.run(user_msg="What is 20+(2*4)?")
    print(response)

asyncio.run(main())
```

**重要**: `agent.run()` は常に `async`。同期呼び出しはできない。

### ReActAgent

```python
from llama_index.core.agent.workflow import ReActAgent

agent = ReActAgent(tools=[multiply, add], llm=llm)
response = await agent.run("What is 20+(2*4)?")
```

内部推論: `Thought → Action → Observation → Answer` のループ。

### Tool 定義

```python
# 方法1: 素の Python 関数（docstring + 型ヒントが必須）
def get_weather(location: str) -> str:
    """Useful for getting the weather for a given location."""
    return f"Sunny in {location}"

# 方法2: FunctionTool（名前・説明をカスタマイズ）
from llama_index.core.tools import FunctionTool
tool = FunctionTool.from_defaults(
    get_weather, name="weather_lookup", description="Look up current weather"
)

# 方法3: QueryEngineTool（RAG インデックスをツール化）
from llama_index.core.tools import QueryEngineTool
tool = QueryEngineTool.from_defaults(
    query_engine, name="docs", description="Search internal documents"
)

# 方法4: Annotated で引数の詳細説明
from typing import Annotated
def search(
    query: Annotated[str, "Search query in natural language"],
    limit: Annotated[int, "Max results to return"] = 5,
) -> str:
    """Search the database."""
    ...
```

### Context 対応ツール（ワークフロー状態にアクセス）

```python
from llama_index.core.workflow import Context

async def record_notes(ctx: Context, notes: str, title: str) -> str:
    """Record research notes."""
    async with ctx.store.edit_state() as ctx_state:
        ctx_state["state"]["research_notes"][title] = notes
    return "Notes recorded."

agent = FunctionAgent(
    tools=[record_notes],
    llm=llm,
    initial_state={"research_notes": {}},
)
```

第一引数に `ctx: Context` を含めるとフレームワークが自動注入する。

### 会話履歴の保持

```python
from llama_index.core.workflow import Context

ctx = Context(agent)
response = await agent.run(user_msg="My name is Alice.", ctx=ctx)
response = await agent.run(user_msg="What is my name?", ctx=ctx)

# Context のシリアライズ（保存・復元）
from llama_index.core.workflow import JsonSerializer
ctx_dict = ctx.to_dict(serializer=JsonSerializer())
restored = Context.from_dict(agent, ctx_dict, serializer=JsonSerializer())
```

### Memory（長期記憶）

`ChatMemoryBuffer` は**非推奨**。`Memory` クラスを使う。

```python
from llama_index.core.memory import Memory

memory = Memory.from_defaults(session_id="session-1", token_limit=40000)
response = await agent.run("Hello!", memory=memory)
response = await agent.run("What did I just say?", memory=memory)
```

### MemoryBlock（長期メモリ拡張）

```python
from llama_index.core.memory import (
    Memory, StaticMemoryBlock, FactExtractionMemoryBlock,
)

blocks = [
    StaticMemoryBlock(
        name="core_info",
        static_content="User prefers Japanese responses.",
        priority=0,  # 0 = 絶対に切り捨てない
    ),
    FactExtractionMemoryBlock(
        name="extracted_facts",
        llm=llm, max_facts=50, priority=1,
    ),
]

memory = Memory.from_defaults(
    session_id="session-1", token_limit=40000, memory_blocks=blocks,
)
```

### DB 永続化

```python
memory = Memory.from_defaults(
    session_id="session-1",
    async_database_uri="postgresql+asyncpg://user:pass@localhost:5432/db",
)
```

### Agent ストリーミング

```python
from llama_index.core.agent.workflow import AgentStream, ToolCall, ToolCallResult

handler = agent.run(user_msg="What is the weather?")
async for event in handler.stream_events():
    if isinstance(event, AgentStream):
        print(event.delta, end="", flush=True)
    elif isinstance(event, ToolCall):
        print(f"\nTool: {event.tool_name}({event.tool_kwargs})")
    elif isinstance(event, ToolCallResult):
        print(f"\nResult: {event.tool_output}")

response = await handler
```

### Human-in-the-Loop

```python
from llama_index.core.workflow import (
    Context, InputRequiredEvent, HumanResponseEvent,
)

async def dangerous_task(ctx: Context) -> str:
    """A task that requires human confirmation."""
    response = await ctx.wait_for_event(
        HumanResponseEvent,
        waiter_id="confirm_action",
        waiter_event=InputRequiredEvent(prefix="Proceed?", user_name="admin"),
        requirements={"user_name": "admin"},
    )
    if response.response == "yes":
        return "Task completed."
    return "Task aborted."
```

---

## マルチエージェント（AgentWorkflow）

### パターン1: AgentWorkflow（推奨・最もシンプル）

```python
from llama_index.core.agent.workflow import AgentWorkflow, FunctionAgent

research_agent = FunctionAgent(
    name="ResearchAgent",
    description="Search the web and record notes.",
    system_prompt="You are a researcher. Hand off to WriteAgent when ready.",
    llm=llm,
    tools=[search_web, record_notes],
    can_handoff_to=["WriteAgent"],
)

write_agent = FunctionAgent(
    name="WriteAgent",
    description="Writes a report from the notes.",
    system_prompt="You are a writer.",
    llm=llm,
    tools=[write_report],
    can_handoff_to=["ReviewAgent", "ResearchAgent"],
)

review_agent = FunctionAgent(
    name="ReviewAgent",
    description="Reviews a report.",
    system_prompt="You are a reviewer.",
    llm=llm,
    tools=[review_report],
    can_handoff_to=["WriteAgent"],
)

workflow = AgentWorkflow(
    agents=[research_agent, write_agent, review_agent],
    root_agent=research_agent.name,
    initial_state={"research_notes": {}, "report": ""},
)

response = await workflow.run(user_msg="Write a report on AI trends.")
```

`can_handoff_to` で指定したエージェントへのハンドオフが自動的にツールとして追加される。

### パターン2: Orchestrator Agent（中程度の柔軟性）

サブエージェントの `run()` をツールとしてラップし、1つのオーケストレーターが制御する。

```python
async def call_research(ctx: Context, prompt: str) -> str:
    """Delegate research to the research agent."""
    result = await research_agent.run(user_msg=prompt)
    async with ctx.store.edit_state() as state:
        state["state"]["notes"].append(str(result))
    return str(result)

orchestrator = FunctionAgent(
    system_prompt="Orchestrate research, writing, and review.",
    llm=llm,
    tools=[call_research, call_writer, call_reviewer],
    initial_state={"notes": []},
)
```

### パターン比較

| パターン | コード量 | 柔軟性 | 推奨場面 |
|---|---|---|---|
| AgentWorkflow | 最小 | 中 | プロトタイプ・標準的なフロー |
| Orchestrator | 中 | 高 | 細かい制御が必要 |
| Custom Workflow | 大 | 最高 | 完全カスタムロジック |

---

## Workflow（イベント駆動型）

DAG ではなく **Event + @step** で分岐・ループを自然に記述する。

```python
from llama_index.core.workflow import Workflow, step
from llama_index.core.workflow.events import Event, StartEvent, StopEvent
from llama_index.llms.openai import OpenAI

class JokeEvent(Event):
    joke: str

class JokeFlow(Workflow):
    llm = OpenAI(model="gpt-4.1")

    @step
    async def generate_joke(self, ev: StartEvent) -> JokeEvent:
        prompt = f"Write your best joke about {ev.topic}."
        response = await self.llm.acomplete(prompt)
        return JokeEvent(joke=str(response))

    @step
    async def critique_joke(self, ev: JokeEvent) -> StopEvent:
        prompt = f"Give a critique of: {ev.joke}"
        response = await self.llm.acomplete(prompt)
        return StopEvent(result=str(response))

w = JokeFlow(timeout=60, verbose=False)
result = await w.run(topic="pirates")
```

### 核心概念

| 概念 | 説明 |
|---|---|
| `Event` | Pydantic モデル。ステップ間のデータ受け渡し |
| `StartEvent` | ワークフロー開始。`run()` のキーワード引数が属性になる |
| `StopEvent` | ワークフロー終了。`result` に最終結果を格納 |
| `@step` | メソッドをステップに。型ヒントから入出力イベントを自動推論 |
| `Context` | ステップ間で共有されるグローバル状態 |

---

## Observability

### Instrumentation モジュール（v0.10.20+）

```python
import llama_index.core.instrumentation as instrument
from llama_index.core.instrumentation.event_handlers.base import BaseEventHandler
from llama_index.core.instrumentation.events.base import BaseEvent

class MyEventHandler(BaseEventHandler):
    @classmethod
    def class_name(cls) -> str:
        return "MyEventHandler"

    def handle(self, event: BaseEvent, **kwargs):
        print(f"Event: {event.class_name()}")

dispatcher = instrument.get_dispatcher(__name__)
dispatcher.add_event_handler(MyEventHandler())
```

### 対応プラットフォーム

| プラットフォーム | 特徴 |
|---|---|
| **OpenTelemetry** | 標準トレーシング。Jaeger, Zipkin 対応 |
| **Arize Phoenix** | LLM 専用トレース + 評価 |
| **MLflow** | `mlflow.llama_index.autolog()` で一発有効化 |
| **Langfuse** | オープンソース LLM エンジニアリング |
| **W&B Weave** | トークン・コスト追跡 |

```python
# MLflow の例
import mlflow
mlflow.llama_index.autolog()
# 以降の操作が自動トレースされる
```

---

## 落とし穴・注意点

| 症状 | 原因・対処 |
|---|---|
| `agent.run()` が動かない | `await` を忘れている。全 Agent API は async 必須 |
| ツールが選ばれない | docstring が不正確 or 型ヒントがない。LLM はこれを読んで判断する |
| `ChatMemoryBuffer` でメモリが消える | 非推奨。`Memory` クラスに移行する |
| `WorkflowValidationError` | `@step` の引数に `Event` 型がない。戻り値の型ヒントも必須 |
| CodeActAgent で任意コード実行 | **本番では Docker サンドボックスを使う**。インプロセス実行は禁止 |
| AgentWorkflow で意図しないハンドオフ | `can_handoff_to` を限定し、system_prompt でハンドオフ条件を明記 |
| Settings が別モジュールで上書きされる | Settings はシングルトン。複数モジュールから書くと競合する |
| ReActAgent の精度が低い | プロンプトベースなのでモデル品質に依存。FunctionAgent を優先 |
| Memory のトークン超過 | `token_limit` を設定。`priority` で切り捨て順を制御 |
| インデックス復元時に埋め込みが再計算される | `StorageContext.persist()` で保存し `load_index_from_storage()` で復元 |

---

## パフォーマンス最適化

### チャンクサイズの指針

| サイズ | 特性 |
|---|---|
| 256 | 精度高いが文脈が失われやすい |
| 512（推奨） | バランス良い。最初に試す値 |
| 1024 | コンテキスト豊富だが検索精度低下 |

### similarity_top_k

- **3-5** で開始して調整する
- 少ない k: 高速・低リコール / 多い k: 高リコール・高レイテンシ

### コスト最適化

```python
# compact モード: LLM 呼び出し最小化（デフォルト・推奨）
query_engine = index.as_query_engine(response_mode="compact")

# no_text: LLM 呼び出しゼロ（検索結果のみ）
query_engine = index.as_query_engine(response_mode="no_text")
```

### 並列処理

```python
documents = SimpleDirectoryReader("data").load_data(num_workers=4)
nodes = pipeline.run(documents=documents, num_workers=4)
```

---

## セキュリティチェックリスト

- [ ] API キーを環境変数から読み込んでいるか（ハードコード禁止）
- [ ] ツールの docstring と型ヒントが正確に定義されているか
- [ ] CodeActAgent を使う場合、Docker サンドボックスで実行しているか
- [ ] ユーザー入力をそのままプロンプトに埋め込んでいないか（インジェクション対策）
- [ ] `agent.run()` に `timeout` を設定しているか（Workflow レベルで指定）
- [ ] AgentWorkflow の `can_handoff_to` が最小限に制限されているか
- [ ] Memory の `token_limit` を設定して無限増大を防いでいるか
- [ ] 本番環境でトレーシング（OpenTelemetry / MLflow 等）を有効にしているか

---

## レビュー観点（ai-agent-reviewer 向け）

LlamaIndex アプリケーションのコードを見るときは以下を確認する。

- [ ] `Settings` のグローバル設定が適切か（LLM, Embedding, chunk_size）
- [ ] Agent の `run()` が `await` されているか
- [ ] ツールに docstring と型ヒントがあるか
- [ ] `ChatMemoryBuffer` ではなく `Memory` を使っているか
- [ ] `can_handoff_to` が適切に制限されているか
- [ ] 外部ベクトルストア使用時に `StorageContext` 経由で接続しているか
- [ ] `similarity_top_k` と `response_mode` が用途に合っているか
- [ ] Workflow の `@step` で型ヒントが正しく設定されているか
- [ ] CodeActAgent がサンドボックスなしで使われていないか
- [ ] API キーがハードコードされていないか
