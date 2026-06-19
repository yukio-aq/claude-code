---
last_updated: 2026-05-09
confidence: high
review_after: 2026-11-09
---

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

### `|| undefined` で jose の issuer/audience 検証が無効化される

**問題:** 環境変数のデフォルトが `""` のとき `config.oidc.issuer || undefined` が `undefined` になり、jose の `jwtVerify` は issuer/audience の検証をスキップする。

**発生状況:** OIDC 設定を env var から読み込み、`|| undefined` でオプション化している jose/jsonwebtoken のセットアップ。

**悪い例:**
```ts
// NG: config.oidc.issuer が "" のとき undefined になり検証なし
issuer: config.oidc.issuer || undefined,
```

**良い例:**
```ts
// OK: 起動時に必須 env var をチェックして未設定なら例外を出す
if (!config.oidc.issuer) throw new Error("OIDC_ISSUER not configured");
issuer: config.oidc.issuer,
```

**根拠:** jose の `jwtVerify` は `issuer` / `audience` が `undefined` の場合に検証をスキップする仕様。env var のデフォルト `""` と `|| undefined` の組み合わせは jose/jsonwebtoken 両方で検証無効化を招く。起動時バリデーションで必須値を明示的にチェックする。

---

### 権限チェックと接続状態チェックを同一視する

**問題:** 外部サービスへの「アクセス権 (HasAccess)」と「OAuth 接続済み (Connected)」を同一視すると、未接続ユーザーに使用不可のエンドポイントが案内される。

**発生状況:** MCP/API エンドポイントの公開条件を実装するとき。コメントに "access/connection status" と書いてあってもコードが一方しか確認していないケース。

**悪い例:**
```ts
// NG: HasAccess しか確認していない → 未接続ユーザーも通過する
if (!user.hasAccess(service)) return forbidden()
// 接続済みかのチェックがない
return handleRequest()
```

**良い例:**
```ts
// OK: 権限と接続状態を独立して確認する
if (!user.hasAccess(service)) return forbidden()
if (!user.isConnected(service)) return unprocessableEntity({ connectUrl })
return handleRequest()
```

**根拠:** 権限 (HasAccess) と接続 (Connected) は独立した条件。権限のみで絞り込むと、接続が必要な操作に未接続ユーザーが到達する。レビュー時はコメントと実装の両方を確認する。

---

### OAuth コールバックの sessionStorage クリーンアップを成功パスのみに書く

**問題:** OAuth コールバックで `sessionStorage.removeItem` を成功パスだけに置くと、認証エラーや例外発生時にストレージが残留する。

**発生状況:** OAuth コールバックページで認証後に sessionStorage から state・code_verifier 等を削除するとき。

**悪い例:**
```typescript
// NG: 認証エラー時や例外時に removeItem が実行されない
try {
  const tokens = await exchangeCode(code)
  sessionStorage.removeItem('oauth_state') // 成功パスのみ
  navigate('/dashboard')
} catch (e) {
  showError(e) // ストレージが残留する
}
```

**良い例:**
```typescript
// OK: finally でどのパスでも必ずクリアする
try {
  const tokens = await exchangeCode(code)
  navigate('/dashboard')
} catch (e) {
  showError(e)
} finally {
  sessionStorage.removeItem('oauth_state') // 成功・失敗どちらでも必ず実行
  sessionStorage.removeItem('code_verifier')
}
```

**根拠:** 認証フローで使った一時データ（state・code_verifier・nonce 等）は成功・失敗に関わらず必ず削除する。`finally` で保証することで、例外や認証エラー時にストレージが残留してリプレイ攻撃や情報漏洩のリスクになるのを防ぐ。

---

### LLM プロンプトで「問題なければ ok=true」と誘導する

**問題:** 「問題がなければ必ず ok=true を返してください」という誘導は、境界ケースで ok=true に倒すバイアスをモデルに与える。安全審査など見逃しのコストが高い用途では致命的。

**発生状況:** LLM に安全審査・品質チェック・コンテンツ審査を依頼するプロンプトを書くとき。

**悪い例:**
```python
# NG: 「問題なければ ok=true」という誘導でモデルが ok=true に倒す
prompt = """
画像を審査し、問題がなければ必ず ok=true を返してください。
Output: {"ok": bool, "issues": list[str]}
"""
```

**良い例:**
```python
# OK: 中立的な指示で「問題が1件もない場合のみ ok=true」と明示する
prompt = """
画像を審査してください。
- 問題が1件もない場合のみ ok=true
- 確認不能・判断が難しい項目も issues に列挙する
Output: {"ok": bool, "issues": list[str]}
"""
```

**根拠:** LLM は肯定的な結果（ok=true）を返すよう誘導されると、曖昧なケースでも ok=true に倒しやすい。見逃しコストが高い審査では「問題ゼロの場合のみ ok」「不確定項目も列挙」という中立的な指示にして、モデルのバイアスを排除する。

---

### LLM 安全審査で API エラー時に「問題なし」をサイレントに返す

**問題:** 外部 AI API がタイムアウト・例外で失敗した場合に `{"ok": True}` を返すと、「審査失敗」と「問題なし」を呼び出し側が区別できなくなる。

**発生状況:** LLM バックエンドで外部 AI API（Gemini・GPT 等）を呼ぶ審査処理を `try/except` でラップするとき。

**悪い例:**
```python
# NG: 例外時に ok=True を返す → API 障害が「問題なし」と区別できない
try:
    result = await gemini.check_safety(content)
    return result
except Exception:
    return {"ok": True}  # サイレントに「問題なし」として扱う
```

**良い例:**
```python
# OK: エラーフラグを立てて呼び出し側が区別できるようにする
try:
    result = await gemini.check_safety(content)
    return result
except Exception as e:
    return {"ok": False, "_failed": True, "error": str(e)}
    # ルーター層で _failed を見て 503 に変換する
```

**根拠:** 外部 API 障害を「問題なし」にサイレント変換すると、障害中も審査が通り続ける。エラー時は `_failed` 等のフラグを立てて呼び出し側（ルーター）が 503 を返せるようにする。

---

### 外部 AI API に渡す前にファイルの MIME タイプを検証しない

**問題:** クライアントの申告値（Content-Type）を信頼してそのまま外部 AI API に渡すと、非対応形式による API エラーや悪意あるファイルの処理リスクが生じる。

**発生状況:** ファイルアップロードを受け付けて Gemini 等のマルチモーダル API に渡すサービス層の実装。

**悪い例:**
```python
# NG: Content-Type をそのまま信頼して渡す
async def process_file(file: UploadFile):
    content = await file.read()
    return await gemini.process(content, mime_type=file.content_type)
```

**良い例:**
```python
# OK: サーバー側でホワイトリスト検証してから渡す
ALLOWED_MIME_TYPES = frozenset({"image/jpeg", "image/png", "image/webp", "application/pdf"})

async def process_file(file: UploadFile):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"Unsupported MIME type: {file.content_type}")
    content = await file.read()
    return await gemini.process(content, mime_type=file.content_type)
```

**根拠:** HTTP の Content-Type はクライアントが自由に設定できるため信頼できない。`frozenset` 等で許可タイプを明示的に定義し、サービス層で早期拒否することで不要な外部 API 呼び出しとセキュリティリスクを両方防ぐ。

---

### LLM 出力をホワイトリスト検証なしで API レスポンスに流す

**問題:** プロンプトで列挙値を指定していても LLM の準拠は保証されない。予期しない文字列やプロンプトインジェクションの結果がそのまま API レスポンスに混入するリスクがある。

**発生状況:** LLM が返したカテゴリ文字列・ステータス値等を加工せずそのまま API レスポンスに含めるとき。

**悪い例:**
```python
# NG: LLM の出力をそのまま返す → 想定外の値や長大な文字列が混入しうる
result = await llm.classify(text)
return {"category": result["category"]}
```

**良い例:**
```python
# OK: ホワイトリスト検証 + 文字数上限を挟む
ALLOWED_CATEGORIES = {"positive", "negative", "neutral"}
MAX_LEN = 500

category = result.get("category", "")
if category not in ALLOWED_CATEGORIES:
    category = "unknown"
label = str(result.get("label", ""))[:MAX_LEN]

return {"category": category, "label": label}
```

**根拠:** LLM はプロンプト通りに出力するとは限らない。ホワイトリスト検証で想定外の値をブロックし、文字数上限で長大な出力の流出を防ぐ。

---

### LLM 出力の配列フィールドを型検証なしでそのまま使う

**問題:** LLM が返すフィールドは、スキーマを指定していても `list` 以外（`dict`・`str`・`None` 等）が来ることがある。後段で反復処理をすると TypeError が発生する。

**発生状況:** LLM の JSON 出力から配列フィールドを取り出して後段の処理に渡すとき。

**悪い例:**
```python
# NG: result["issues"] が dict や None のとき TypeError
for issue in result["issues"]:
    process(issue)
```

**良い例:**
```python
# OK: isinstance でチェックして必ず list に正規化する
raw = result.get("issues")
issues = raw if isinstance(raw, list) else []
for issue in issues:
    process(issue)
```

**根拠:** LLM の出力は型付きスキーマを指定しても実行時の型保証はない。後段の処理がクラッシュしないよう、LLM 出力の post-processing は常に防御的に書く。

---

### 環境変数フラグによる認証バイパスに `DEV` ガードを付けない

**問題:** `VITE_DEV_BYPASS_AUTH` などの開発用バイパスフラグを `import.meta.env.DEV &&` のガードなしで使うと、本番ビルドで env フラグが true に設定された場合に認証がバイパスされる。

**発生状況:** 開発効率化のため認証をスキップするフラグを環境変数で制御するとき。

**悪い例:**
```typescript
// NG: DEV ガードなし → 本番で env フラグが true なら認証スキップ
if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
  return mockUser
}
```

**良い例:**
```typescript
// OK: import.meta.env.DEV との AND 条件で本番を保護する
if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
  return mockUser
}
```

**根拠:** `import.meta.env.DEV` は本番ビルド時に `false` にツリーシェイクされるため、AND 条件を付けることで本番環境への影響をコンパイル時に排除できる。環境変数だけで制御するバイパスは本番設定ミスで有効化されるリスクがある。

---
