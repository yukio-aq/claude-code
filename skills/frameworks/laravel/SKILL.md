---
name: laravel
description: >
  Laravel 13.x の PHP フレームワーク実装パターン。
  backend-implementer / backend-reviewer / architect が
  Laravel アプリケーションを設計・実装・レビューするときに参照する。
---

# Laravel 13.x — 実装スキル

> 公式ドキュメント: https://laravel.com/docs/13.x
> 情報収集日: 2026-08-05
> PHP 要件: >= 8.3 / ライセンス: MIT

---

## PHP 8.3 & モダンな言語機能

Laravel 13 は PHP 8.3 以上を要求。

- **Native PHP Attributes**: クラスプロパティの代わりにアトリビュートで動作を定義。
- **Typed Class Constants**: クラス定数に型を指定。
- **json_validate()**: JSON 文字列の検証に標準関数を使用。

---

## ディレクトリ構成と規約

- `app/Models`: Eloquent モデル。
- `app/Http/Controllers`: HTTP コントローラー。
- `app/Http/Requests`: Form Request（バリデーションロジック）。
- `routes/web.php` / `routes/api.php`: ルーティング。
- `database/migrations`: スキーマ定義。
- `tests/Pest.php` or `tests/TestCase.php`: テスト基盤。

---

## 新機能 (Laravel 13.x 特有)

### Native PHP Attributes

設定をクラスプロパティからアトリビュートへ移行。

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use App\Observers\UserObserver;

#[ObservedBy(UserObserver::class)]
class User extends Model
{
    // プロパティによる $dispatchesEvents などの代わりに使用
}
```

### Laravel AI SDK (Stable)

LLM（OpenAI, Anthropic 等）への統一インターフェース。**`AI::` ファサードは存在しない** — エージェントクラスまたは `agent()` ヘルパー経由で呼び出す。プロバイダ・モデルはメソッドチェーンではなく `prompt()` の名前付き引数で渡す。

```php
use Laravel\Ai\Enums\Lab;

// 匿名エージェント（agent() ヘルパー）
$response = agent(
    instructions: 'あなたはLaravelの専門家です。',
)->prompt(
    'Laravel 13 の特徴を教えてください',
    provider: Lab::Anthropic,
    model: 'claude-sonnet-5',
);

echo $response->text; // プロパティアクセス（メソッド呼び出しではない）
```

### Cache::touch()

キャッシュの値を再取得せずに有効期限を延長。

```php
use Illuminate\Support\Facades\Cache;

Cache::touch('user-session-123', 3600); // 1時間延長
```

---

## ルーティングとコントローラー

### 依存注入 (DI)

```php
namespace App\Http\Controllers;

use App\Services\UserService;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        protected UserService $service
    ) {}

    public function show(string $id)
    {
        return view('user.profile', [
            'user' => $this->service->find($id)
        ]);
    }
}
```

### Queue Routing (`Queue::route()`)

ジョブのルーティングを中央管理。

```php
// app/Providers/AppServiceProvider.php
use Illuminate\Support\Facades\Queue;
use App\Jobs\ProcessVideo;

Queue::route(ProcessVideo::class, 'video-processing');
```

---

## Eloquent ORM と データベース

### Vector Search (pgvector 等)

```php
use App\Models\Document;

$documents = Document::query()
    ->whereNearestTo('embedding', $queryVector)
    ->limit(5)
    ->get();
```

### JSON:API Resources

第一級の JSON:API サポート。

```php
use App\Http\Resources\UserResource;

return UserResource::make($user);
```

---

## バリデーション (Form Requests)

```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
        ];
    }
}
```

---

## テスト (Pest 推奨)

```php
it('has a welcome page', function () {
    $response = $this->get('/');

    $response->assertStatus(200);
});

it('can create a user', function () {
    $user = User::factory()->create();
    expect($user->name)->not->toBeEmpty();
});
```

---

## セキュリティチェックリスト

- [ ] `APP_DEBUG` が本番で `false` か
- [ ] Mass Assignment 対策（`$fillable` or `$guarded`）がされているか
- [ ] Origin-aware な CSRF 対策が有効か (`PreventRequestForgery`)
- [ ] API トークンが安全に管理されているか
- [ ] バリデーションがすべての入力に対して行われているか

---

## レビュー観点

- [ ] コントローラーが Fat になっていないか（Service クラスへの委譲）
- [ ] N+1 クエリが発生していないか（`with()` の使用）
- [ ] Native PHP Attributes が適切に使われているか
- [ ] Form Request でバリデーションが分離されているか
- [ ] ビジネスロジックがモデルやコントローラーに混在していないか
