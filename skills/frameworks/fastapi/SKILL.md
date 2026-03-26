---
name: fastapi
description: FastAPI のベストプラクティス（2026年版）。backend-implementer / backend-reviewer が参照する。Python 3.12+ / Pydantic v2 ベース。
---

# FastAPI — ベストプラクティス

> 情報収集日: 2026-03-23 / FastAPI 0.135.x / Pydantic v2 / Python 3.12+ ベース

## FastAPIの特徴（2026）

- **非同期ファースト** — async/await ネイティブ対応
- **型安全** — Pydantic v2 + Python 型ヒントで自動バリデーション
- **自動ドキュメント** — OpenAPI (Swagger UI / ReDoc) が自動生成
- **AI/ML 親和性** — 推論API・ストリーミングレスポンスに最適

---

## インストール

```bash
# v0.130+ 推奨: [standard] extras でCLIツール含む
pip install "fastapi[standard]"

# 開発サーバーの起動
fastapi dev src/main.py

# デプロイ（fastapi-cloud-cli 統合）
fastapi deploy
```

---

## プロジェクト構成

```
src/
├── main.py                # FastAPIアプリのエントリポイント
├── config.py              # 設定（pydantic-settings）
├── dependencies.py        # DI（依存注入）の定義
│
├── routers/               # ルーター（コントローラー相当）
│   ├── users.py
│   └── auth.py
│
├── services/              # ビジネスロジック
│   └── user_service.py
│
├── repositories/          # DB操作
│   └── user_repository.py
│
├── models/                # Pydanticモデル（スキーマ）
│   ├── user.py
│   └── common.py
│
├── domain/                # ドメインエンティティ（DDDを使う場合）
│   └── user.py
│
└── db/
    └── session.py         # DBセッション管理
```

---

## 設定管理（pydantic-settings）

```python
# src/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    frontend_url: str = "http://localhost:3000"

settings = Settings()
```

---

## スキーマ定義（Pydantic v2）

```python
# src/models/user.py
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from uuid import UUID

# リクエストスキーマ
class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('名前は空にできません')
        return v.strip()

    @field_validator('password')
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('パスワードは8文字以上である必要があります')
        return v

# レスポンススキーマ（機密情報を含まない）
class UserResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    created_at: datetime

    model_config = {"from_attributes": True}  # ORM モデルから変換可能に

# ページネーション付きレスポンス
class PaginatedResponse[T](BaseModel):
    success: bool = True
    data: list[T]
    pagination: dict
```

---

## ルーター定義

```python
# src/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from ..dependencies import get_current_user, get_user_service
from ..models.user import CreateUserRequest, UserResponse
from ..services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=list[UserResponse])
async def list_users(
    page: int = 1,
    per_page: int = 20,
    service: UserService = Depends(get_user_service),
    current_user = Depends(get_current_user),  # 認証必須
):
    return await service.list_users(page=page, per_page=per_page)

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,  # Pydanticで自動バリデーション
    service: UserService = Depends(get_user_service),
):
    return await service.create_user(body)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    service: UserService = Depends(get_user_service),
    current_user = Depends(get_current_user),
):
    user = await service.find_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "ユーザーが見つかりません"},
        )
    return user
```

---

## 依存注入（Depends）

```python
# src/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from .db.session import get_db_session
from .services.user_service import UserService
from .config import settings

security = HTTPBearer()

async def get_user_service(
    db: AsyncSession = Depends(get_db_session),
) -> UserService:
    return UserService(db)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db_session),
):
    token = credentials.credentials
    payload = verify_jwt(token, settings.secret_key)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_INVALID_TOKEN", "message": "トークンが無効です"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
```

---

## エラーハンドリング

```python
# src/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

# v0.130+: strict_content_type のデフォルトが True に変更
# 既存クライアントが Content-Type: application/json を送っていない場合は False に設定
app = FastAPI(strict_content_type=True)

# バリデーションエラーのカスタムレスポンス
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "リクエストの形式が正しくありません",
                "details": exc.errors(),
            },
        },
    )

# カスタムドメインエラー
class DomainError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code

@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": exc.code, "message": exc.message}},
    )
```

---

## 非同期の使い分け

```python
# ✅ I/O操作（DB・外部API）は async def
@router.get("/users")
async def get_users(db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(User))
    return result.scalars().all()

# ✅ CPU集約処理は同期関数に（FastAPIがスレッドプールで実行）
@router.post("/process-image")
def process_image(file: UploadFile):
    # 画像処理などCPU集約タスクは同期関数で
    result = heavy_image_processing(file)
    return result

# ❌ CPU集約処理を async def にする（イベントループをブロックする）
@router.post("/process-image")
async def process_image(file: UploadFile):
    result = heavy_cpu_task(file)  # ← イベントループがブロックされる
    return result
```

---

## ストリーミングレスポンス（AI/LLM用途）

```python
from fastapi.responses import StreamingResponse

@router.post("/chat")
async def chat(body: ChatRequest):
    async def generate():
        async for chunk in llm.stream(body.message):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

---

## テスト

```python
# tests/test_users.py
import pytest
from httpx import AsyncClient, ASGITransport
from src.main import app

@pytest.mark.asyncio
async def test_create_user():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post("/users", json={
            "name": "Test User",
            "email": "test@example.com",
            "password": "password123",
        })
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == "test@example.com"
```

---

## v0.115 → v0.135 移行チェックリスト

- [ ] `pip install "fastapi[standard]"` に変更（`fastapi-slim` は廃止）
- [ ] `FastAPI(strict_content_type=True)` が既存クライアントに影響しないか確認
  - クライアントが `Content-Type: application/json` を送っていない場合は `strict_content_type=False` に設定
- [ ] Python を 3.12 以上に更新（3.13 推奨）
- [ ] `ORJSONResponse` / `UJSONResponse` を使っている場合はリリースノートを確認（0.130系で breaking changes あり）
