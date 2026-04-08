---
name: langchain
description: >
  LangChain Python v1.0 の エージェント・ツール・ミドルウェア・メモリ実装パターン。
  ai-agent-implementer / ai-agent-reviewer が LangChain エージェントを
  実装・レビューするときに参照する。
---

# LangChain Python v1.0 — 実装スキル

> 公式ドキュメント: https://docs.langchain.com/oss/python/langchain/overview
> クイックスタート: https://docs.langchain.com/oss/python/langchain/quickstart

---

## インストール

```bash
pip install -qU "langchain[anthropic]"
# または
pip install langchain langchain-openai langchain-anthropic langgraph
```

---

## 基本エージェントの作り方

```python
from langchain.agents import create_agent

def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"

agent = create_agent(
    model="anthropic:claude-sonnet-4-6",
    tools=[get_weather],
    system_prompt="You are a helpful assistant",
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "what is the weather in sf"}]}
)
```

### モデル指定のパターン

```python
# 文字列による省略形（provider:model）
agent = create_agent("anthropic:claude-sonnet-4-6", tools=tools)
agent = create_agent("openai:gpt-4.1", tools=tools)

# モデルインスタンスで詳細設定する場合
from langchain.chat_models import init_chat_model

model = init_chat_model(
    "claude-sonnet-4-6",
    temperature=0.5,
    timeout=10,
    max_tokens=1000,
)
agent = create_agent(model, tools=tools)
```

---

## ツール定義

### 基本（`@tool` デコレータ）

```python
from langchain.tools import tool

@tool
def search_database(query: str, limit: int = 10) -> str:
    """Search the customer database for records matching the query.

    Args:
        query: Search terms to look for
        limit: Maximum number of results to return
    """
    return f"Found {limit} results for '{query}'"
```

- 型ヒントは必須（入力スキーマの定義に使われる）
- docstringがモデルへのツール説明になる。簡潔かつ具体的に書く
- ツール名は `snake_case` のみ使用（スペース・特殊文字禁止）

### Pydanticスキーマで複雑な入力を定義する

```python
from pydantic import BaseModel, Field
from typing import Literal
from langchain.tools import tool

class WeatherInput(BaseModel):
    """Input for weather queries."""
    location: str = Field(description="City name or coordinates")
    units: Literal["celsius", "fahrenheit"] = Field(
        default="celsius",
        description="Temperature unit preference"
    )

@tool(args_schema=WeatherInput)
def get_weather(location: str, units: str = "celsius") -> str:
    """Get current weather."""
    temp = 22 if units == "celsius" else 72
    return f"Weather in {location}: {temp}°{units[0].upper()}"
```

### カスタム名・説明の上書き

```python
@tool("web_search", description="Search the web for up-to-date information.")
def search(query: str) -> str:
    """Search online."""
    ...
```

### 予約済みパラメータ名（使用禁止）

| 名前      | 理由                         |
| --------- | ---------------------------- |
| `config`  | 内部で RunnableConfig に使用 |
| `runtime` | ToolRuntime の注入に予約済み |

---

## ToolRuntime — ツール内からの実行時情報アクセス

`runtime: ToolRuntime` をツールのシグネチャに追加すると自動注入される。
モデルには見えない隠しパラメータ。

### State（短期メモリ）

```python
from langchain.tools import tool, ToolRuntime
from langchain.messages import HumanMessage

@tool
def get_last_user_message(runtime: ToolRuntime) -> str:
    """Get the most recent message from the user."""
    messages = runtime.state["messages"]
    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            return message.content
    return "No user messages found"
```

### State の更新（`Command` を返す）

```python
from langgraph.types import Command
from langchain.tools import tool, ToolRuntime
from langchain.messages import ToolMessage

@tool
def set_language(language: str, runtime: ToolRuntime) -> Command:
    """Set the preferred response language."""
    return Command(
        update={
            "preferred_language": language,
            "messages": [
                ToolMessage(
                    content=f"Language set to {language}.",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )
```

### Context（呼び出し時の不変設定）

```python
from dataclasses import dataclass
from langchain.tools import tool, ToolRuntime

@dataclass
class UserContext:
    user_id: str

@tool
def get_account_info(runtime: ToolRuntime[UserContext]) -> str:
    """Get the current user's account information."""
    user_id = runtime.context.user_id
    # DBから取得するなど
    return f"Account: {user_id}"

# エージェント作成時に context_schema を指定
agent = create_agent(
    model,
    tools=[get_account_info],
    context_schema=UserContext,
)

# 呼び出し時に context を渡す
result = agent.invoke(
    {"messages": [{"role": "user", "content": "Show my account info"}]},
    context=UserContext(user_id="user123"),
)
```

### Store（長期メモリ・セッション横断）

```python
from langgraph.store.memory import InMemoryStore
from langchain.tools import tool, ToolRuntime

@tool
def save_user_info(user_id: str, info: dict, runtime: ToolRuntime) -> str:
    """Save user info to persistent store."""
    runtime.store.put(("users",), user_id, info)
    return "Saved."

@tool
def get_user_info(user_id: str, runtime: ToolRuntime) -> str:
    """Load user info from persistent store."""
    item = runtime.store.get(("users",), user_id)
    return str(item.value) if item else "Not found"

store = InMemoryStore()  # 本番では PostgresStore を使う
agent = create_agent(model, tools=[save_user_info, get_user_info], store=store)
```

### Stream Writer（ツール実行中のリアルタイム更新）

```python
@tool
def long_running_task(query: str, runtime: ToolRuntime) -> str:
    """Run a task with progress updates."""
    writer = runtime.stream_writer
    writer(f"Starting task for: {query}")
    # ... 処理 ...
    writer("Task complete")
    return "Done"
```

---

## メモリ（短期・会話履歴）

```python
from langgraph.checkpoint.memory import InMemorySaver

checkpointer = InMemorySaver()  # 本番ではDBチェックポインタを使う

agent = create_agent(
    model=model,
    tools=tools,
    checkpointer=checkpointer,
)

# thread_id で会話を識別・継続
config = {"configurable": {"thread_id": "session-123"}}

response1 = agent.invoke(
    {"messages": [{"role": "user", "content": "My name is Alice"}]},
    config=config,
)
response2 = agent.invoke(
    {"messages": [{"role": "user", "content": "What's my name?"}]},
    config=config,  # 同じ thread_id → 会話履歴が維持される
)
```

---

## 構造化出力（Structured Output）

### ToolStrategy（tool calling を使う方式）

```python
from dataclasses import dataclass
from pydantic import BaseModel
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

class ContactInfo(BaseModel):
    name: str
    email: str
    phone: str

agent = create_agent(
    model="openai:gpt-4.1",
    tools=[search_tool],
    response_format=ToolStrategy(ContactInfo),
)

result = agent.invoke({"messages": [{"role": "user", "content": "..."}]})
contact = result["structured_response"]  # ContactInfo インスタンス
```

### ProviderStrategy（プロバイダーネイティブの構造化出力）

```python
from langchain.agents.structured_output import ProviderStrategy

agent = create_agent(
    model="openai:gpt-4.1",
    response_format=ProviderStrategy(ContactInfo),
)
# langchain 1.0 以降は response_format=ContactInfo でも自動判定される
```

---

## ミドルウェア（Middleware）

ミドルウェアはエージェントループの各フックに処理を挟む仕組み。

```
入力 → [before_model] → モデル → [after_model] → ツール → [wrap_tool_call] → ...
```

### ログ・モニタリング（`@before_model` / `@after_model`）

```python
from langchain.agents.middleware import before_model, after_model, ModelRequest, ModelResponse

@before_model
def log_request(request: ModelRequest, handler) -> ModelResponse:
    print(f"Calling model with {len(request.state['messages'])} messages")
    return handler(request)

@after_model
def log_response(request: ModelRequest, response: ModelResponse) -> ModelResponse:
    print(f"Model responded with {len(response.content)} chars")
    return response

agent = create_agent(model, tools=tools, middleware=[log_request, log_response])
```

### ツールエラーのカスタムハンドリング

```python
from langchain.agents.middleware import wrap_tool_call
from langchain.messages import ToolMessage

@wrap_tool_call
def handle_tool_errors(request, handler):
    """Handle tool execution errors with custom messages."""
    try:
        return handler(request)
    except ValueError as e:
        return ToolMessage(
            content=f"Invalid input: {str(e)}. Please check your parameters.",
            tool_call_id=request.tool_call["id"],
        )
    except Exception as e:
        return ToolMessage(
            content=f"Tool error. Please try again with different parameters.",
            tool_call_id=request.tool_call["id"],
        )
```

### 動的モデル選択（コスト最適化）

```python
from langchain_openai import ChatOpenAI
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse

cheap_model = ChatOpenAI(model="gpt-4.1-mini")
smart_model = ChatOpenAI(model="gpt-4.1")

@wrap_model_call
def select_model_by_complexity(request: ModelRequest, handler) -> ModelResponse:
    """Use cheap model for simple tasks, smart model for complex ones."""
    message_count = len(request.state["messages"])
    model = smart_model if message_count > 10 else cheap_model
    return handler(request.override(model=model))

agent = create_agent(
    model=cheap_model,  # デフォルト
    tools=tools,
    middleware=[select_model_by_complexity],
)
```

### 動的システムプロンプト

```python
from langchain.agents.middleware import dynamic_prompt, ModelRequest

@dynamic_prompt
def role_based_prompt(request: ModelRequest) -> str:
    """システムプロンプトをユーザーロールに応じて切り替える。"""
    user_role = request.runtime.context.get("user_role", "user")
    base = "You are a helpful assistant."
    if user_role == "expert":
        return f"{base} Provide detailed technical responses."
    elif user_role == "beginner":
        return f"{base} Explain concepts simply and avoid jargon."
    return base
```

### 動的ツール選択（認証・権限ベース）

```python
from langchain.agents.middleware import wrap_model_call

@wrap_model_call
def filter_tools_by_auth(request: ModelRequest, handler) -> ModelResponse:
    """認証状態に応じてツールを絞る。"""
    is_authenticated = request.state.get("authenticated", False)
    if not is_authenticated:
        # 認証なしは public_ プレフィックスのツールのみ
        tools = [t for t in request.tools if t.name.startswith("public_")]
        request = request.override(tools=tools)
    return handler(request)
```

---

## カスタム State（短期メモリ拡張）

```python
from langchain.agents import AgentState

class MyState(AgentState):  # TypedDict として定義（Pydantic 不可）
    user_preferences: dict
    message_count: int

agent = create_agent(
    model,
    tools=tools,
    state_schema=MyState,
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "Hello"}],
    "user_preferences": {"language": "ja"},
    "message_count": 0,
})
```

---

## ストリーミング

```python
from langchain.messages import AIMessage, HumanMessage

for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "Search for AI news and summarize"}]},
    stream_mode="values",
):
    latest = chunk["messages"][-1]
    if latest.content:
        if isinstance(latest, HumanMessage):
            print(f"User: {latest.content}")
        elif isinstance(latest, AIMessage):
            print(f"Agent: {latest.content}")
    elif latest.tool_calls:
        print(f"Calling tools: {[tc['name'] for tc in latest.tool_calls]}")
```

---

## LangSmith によるトレーシング

```bash
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=your_api_key
```

```python
import os

os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_API_KEY"] = "your_api_key"
# 以降の agent.invoke() は自動的にトレースされる
```

---

## 落とし穴・注意点

| 症状                                      | 対処                                                      |
| ----------------------------------------- | --------------------------------------------------------- |
| ツール名に空白や特殊文字                  | `snake_case` のみ使う                                     |
| `config` / `runtime` をツール引数に使う   | 予約語なので別名にする                                    |
| カスタム State に Pydantic モデルを使う   | v1.0 以降は `TypedDict` のみ（`AgentState` を継承）       |
| `bind_tools` 済みモデルと構造化出力を併用 | ProviderStrategy 使用時は bind_tools 済みモデルを渡さない |
| セッション横断のメモリが消える            | `InMemorySaver` は揮発性。本番は DB checkpointer を使う   |
| ツール内で `stream_writer` を使う         | LangGraph 実行コンテキスト外では動作しない                |

---

## セキュリティチェックリスト

- [ ] ユーザー入力をそのままツールの引数やプロンプトに埋め込んでいないか
- [ ] ツールの引数スキーマでバリデーションを定義しているか（Pydantic/型ヒント）
- [ ] 副作用の大きいツール（削除・送信・課金）にConfirmationを設けているか
- [ ] APIキーを環境変数から読み込んでいるか（ハードコード禁止）
- [ ] `max_steps` を設定して無限ループを防いでいるか（デフォルト推奨: 10）
- [ ] LangSmith などでコスト・呼び出し回数を監視しているか
