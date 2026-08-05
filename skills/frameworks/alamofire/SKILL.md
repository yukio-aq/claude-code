---
name: alamofire
description: >
  Alamofire v5.x の実装パターン・Swift Concurrency 対応・RequestInterceptor 設計。
  ios-implementer / ios-reviewer が iOS/macOS の HTTP 通信を
  実装・レビューするときに参照する。
---

# Alamofire v5.x — ベストプラクティス

> 情報収集日: 2026-08-05 / Alamofire 5.12.0 / Swift 6 ベース
> 公式リポジトリ: https://github.com/Alamofire/Alamofire
> 要件: iOS 10.0+ / macOS 10.12+ / Swift 6.0+

---

## インストール（Swift Package Manager 推奨）

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/Alamofire/Alamofire.git", .upToNextMajor(from: "5.12.0"))
]
// target の dependencies に追加
.product(name: "Alamofire", package: "Alamofire")
```

---

## 基本的なリクエスト

```swift
// ✅ Swift Concurrency（推奨）
let value = try await AF.request("https://api.example.com/users")
    .validate()
    .serializingDecodable([User].self)
    .value

// ✅ クロージャベース（フォールバック）
AF.request("https://api.example.com/users")
    .validate()
    .responseDecodable(of: [User].self) { response in
        switch response.result {
        case .success(let users): print(users)
        case .failure(let error): print(error)
        }
    }
```

### `AF` は `Session.default` のショートカット

```swift
// この2つは等価
AF.request(...)
Session.default.request(...)
```

---

## Swift Concurrency パターン（v5.5+ 推奨）

```swift
// 単一リクエスト
let response = await AF.request(...)
    .validate()
    .serializingDecodable(MyType.self)
    .response  // DataResponse<MyType, AFError>

let result = await ...serializingDecodable(MyType.self).result   // Result<MyType, AFError>
let value  = try await ...serializingDecodable(MyType.self).value // MyType (throws on error)

// 並列リクエスト
async let first  = AF.request(...).serializingDecodable(TypeA.self).response
async let second = AF.request(...).serializingDecodable(TypeB.self).response
let (a, b) = await (first, second)

// 自動キャンセル（Task キャンセル時に AF リクエストも止める）
await AF.request(...)
    .serializingDecodable(MyType.self, automaticallyCancelling: true)
    .value
```

---

## パラメーターエンコーディング

```swift
// GET — URL クエリパラメーター
AF.request("https://api.example.com/items",
           parameters: ["page": 1, "limit": 20])

// POST — JSON ボディ（Encodable 型をそのまま渡せる）
struct CreateUser: Encodable { let name: String; let email: String }

AF.request("https://api.example.com/users",
           method: .post,
           parameters: CreateUser(name: "Alice", email: "alice@example.com"),
           encoder: JSONParameterEncoder.default)

// POST — カスタム JSONEncoder（snake_case に変換）
let encoder = JSONEncoder()
encoder.keyEncodingStrategy = .convertToSnakeCase
AF.request(..., encoder: JSONParameterEncoder(encoder: encoder))
```

---

## バリデーションとエラーハンドリング

```swift
// .validate() で 200..<300 以外を自動エラー化（推奨）
AF.request(...)
    .validate()                               // ステータスコード 200..<300 + Content-Type 一致
    .validate(statusCode: 200..<300)         // ステータスコードのみ
    .responseDecodable(of: MyType.self) { response in
        switch response.result {
        case .success(let value):
            print(value)
        case .failure(let error):
            // .validate() なしだと 4xx/5xx もここに入らない
            if let statusCode = response.response?.statusCode {
                print("HTTP \(statusCode): \(error)")
            }
        }
    }
```

> **重要**: `validate()` を呼ばないと 400/500 系はエラーにならない。必ず付ける。

---

## カスタム Session の設計

プロダクションアプリでは `AF`（`Session.default`）を使わず、専用の `Session` をシングルトンとして用意する。

```swift
// NetworkSession.swift
final class NetworkSession {
    static let shared = NetworkSession()

    let session: Session

    private init() {
        let configuration = URLSessionConfiguration.af.default
        configuration.timeoutIntervalForRequest = 30

        // Authorization ヘッダの自動付与 + 401 時の自動リフレッシュ
        let interceptor = AuthInterceptor()

        session = Session(
            configuration: configuration,
            interceptor: interceptor,
            eventMonitors: [NetworkLogger()]
        )
    }
}

// 使用例
let value = try await NetworkSession.shared.session
    .request("https://api.example.com/me")
    .validate()
    .serializingDecodable(User.self)
    .value
```

---

## RequestInterceptor — 認証ヘッダの自動付与とリトライ

Alamofire の最重要パターン。API キー・Bearer Token の付与とトークンリフレッシュをここに集約する。

```swift
final class AuthInterceptor: RequestInterceptor {

    // ── RequestAdapter ──
    // すべてのリクエストに Authorization ヘッダを付与
    func adapt(_ urlRequest: URLRequest,
               for session: Session,
               completion: @escaping (Result<URLRequest, Error>) -> Void) {
        var request = urlRequest
        if let token = TokenStore.shared.accessToken {
            request.headers.add(.authorization(bearerToken: token))
        }
        completion(.success(request))
    }

    // ── RequestRetrier ──
    // 401 を受け取ったらトークンをリフレッシュして1回だけリトライ
    func retry(_ request: Request,
               for session: Session,
               dueTo error: Error,
               completion: @escaping (RetryResult) -> Void) {
        guard let response = request.task?.response as? HTTPURLResponse,
              response.statusCode == 401,
              request.retryCount == 0 else {
            completion(.doNotRetry)
            return
        }

        Task {
            do {
                try await TokenStore.shared.refresh()
                completion(.retry)
            } catch {
                completion(.doNotRetryWithError(error))
            }
        }
    }
}
```

### 既製の `RetryPolicy`（ネットワークエラーの自動リトライ）

```swift
// 冪等なリクエスト（GET, HEAD, DELETE）でネットワークエラー時に自動リトライ
let session = Session(interceptor: RetryPolicy())
```

---

## URLRequestConvertible — Router パターン

エンドポイントをまとめて型安全に管理する。

```swift
enum APIRouter: URLRequestConvertible {
    case getUsers
    case createUser(CreateUserRequest)
    case deleteUser(id: Int)

    private var baseURL: URL { URL(string: "https://api.example.com")! }

    private var method: HTTPMethod {
        switch self {
        case .getUsers:    return .get
        case .createUser:  return .post
        case .deleteUser:  return .delete
        }
    }

    private var path: String {
        switch self {
        case .getUsers:         return "/users"
        case .createUser:       return "/users"
        case .deleteUser(let id): return "/users/\(id)"
        }
    }

    func asURLRequest() throws -> URLRequest {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.method = method

        switch self {
        case .createUser(let body):
            request = try JSONParameterEncoder.default.encode(body, into: request)
        default:
            break
        }
        return request
    }
}

// 使用例
let users = try await AF.request(APIRouter.getUsers)
    .validate()
    .serializingDecodable([User].self)
    .value
```

---

## ロギング（EventMonitor）

```swift
final class NetworkLogger: EventMonitor {
    let queue = DispatchQueue(label: "com.app.networkLogger")

    func requestDidResume(_ request: Request) {
        print("→ \(request.request?.method?.rawValue ?? "") \(request.request?.url?.absoluteString ?? "")")
    }

    func request<Value>(_ request: DataRequest,
                        didParseResponse response: DataResponse<Value, AFError>) {
        let status = response.response?.statusCode ?? 0
        let time = response.metrics?.taskInterval.duration.flatMap { String(format: "%.0fms", $0 * 1000) } ?? "-"
        print("← \(status) [\(time)] \(request.request?.url?.absoluteString ?? "")")
        if case .failure(let error) = response.result {
            print("  Error: \(error)")
        }
    }
}
```

---

## よくある落とし穴

### `validate()` を付け忘れる

```swift
// ❌ 4xx/5xx でも .success になる
AF.request(...).responseDecodable(of: MyType.self) { ... }

// ✅
AF.request(...).validate().responseDecodable(of: MyType.self) { ... }
```

### `AF`（`Session.default`）をそのままプロダクションで使う

```swift
// ❌ 認証・ログ・タイムアウトが設定できない
AF.request(...)

// ✅ カスタム Session を使う
NetworkSession.shared.session.request(...)
```

### `URLSessionConfiguration` に Authorization を設定する

```swift
// ❌ 変更できない・全リクエストに漏洩する
configuration.httpAdditionalHeaders = ["Authorization": token]

// ✅ RequestAdapter で付与する
```

### ネットワークエラーを Reachability で判定する

```swift
// ❌ Reachability でリクエストを止めてはいけない（公式に明記されている）
if reachability.isReachable { AF.request(...) }

// ✅ 常にリクエストを送る。リトライは RetryPolicy に任せる
AF.request(..., interceptor: .retryPolicy)
```

> **注記（Alamofire 5.11.0〜）**: `NetworkReachabilityManager` 自体が iOS 17.4+ / macOS 14.4+ / watchOS 9.4+ / tvOS 17.4+ / visionOS 1.4+ で非推奨化された（Appleが`SCNetworkReachability`系APIを同バージョンで非推奨化したのに追従）。新規実装では Network framework の `NWPathMonitor` への移行を推奨。

---

## レビュー観点（ios-reviewer 向け）

- [ ] `validate()` がすべてのリクエストに付いているか
- [ ] `AF`（`Session.default`）ではなくカスタム `Session` を使っているか
- [ ] 認証ヘッダが `RequestAdapter` で付与されているか（`URLSessionConfiguration` に直書きしていないか）
- [ ] トークンリフレッシュが `RequestRetrier` で実装されているか
- [ ] タイムアウト・リトライポリシーが設定されているか
- [ ] `EventMonitor` でリクエスト/レスポンスのロギングが実装されているか
- [ ] エンドポイントが `URLRequestConvertible`（Router パターン）で管理されているか
- [ ] Swift Concurrency（`serializingDecodable().value`）を使っているか（クロージャのネストを避ける）
- [ ] 証明書ピニングが必要なエンドポイントに `ServerTrustManager` が設定されているか
