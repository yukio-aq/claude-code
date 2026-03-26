---
name: ios-swift
description: Swift 6.2 / SwiftUI (iOS 26) / Xcode 26 のベストプラクティス（2026年版）。ios-implementer / ios-reviewer が参照する。
---

# Swift / SwiftUI — iOS開発ベストプラクティス

> 情報収集日: 2026-03-23 / Swift 6.2 + SwiftUI (iOS 26) + Xcode 26 ベース

---

## バージョン早見表

| ツール | 最新バージョン | 備考 |
|---|---|---|
| Swift | 6.2（2025年9月リリース） | 6.3はQ1 2026 embedded向けが中心 |
| Xcode | 26（WWDC25発表、Xcode 16系は並存） | macOS Sequoia 15.6以上必須 |
| iOS SDK | iOS 26 | Liquid Glass UI、WebView追加 |
| Swift Testing | Xcode 16同梱、Xcode 26で強化 | XCTestと共存可 |

---

## 1. Swift 6.2 の主要変更

### Approachable Concurrency（最重要）

Swift 6.0 の厳格な並行性チェックが多くのエラーを生んだ反省から、Swift 6.2 では「段階的開示」方式を採用。

**3フェーズモデル:**
1. シングルスレッドな同期コード（デフォルト）
2. `async/await` で非同期コード（並列化なし）
3. `@concurrent` で明示的に並列処理

**Xcode 26のビルド設定（新規プロジェクトのデフォルト）:**
- `Default Actor Isolation` → `MainActor`
- `Approachable Concurrency` → `YES`（`NonisolatedNonsendingByDefault` を有効化）

```swift
// ❌ Swift 6.0以前: nonisolated async関数はグローバルExecutorで実行
// → @MainActorから呼んでもバックグラウンドスレッドに飛ぶ

// ✅ Swift 6.2 + Approachable Concurrency ON:
// nonisolated async関数は呼び出し元のActorで実行される（スレッドホッピングなし）
class NetworkingClient {
    func loadUserPhotos() async throws -> [Photo] {
        // MainActorから呼ばれれば MainActor上で実行
        // ...
    }
}

// 明示的にバックグラウンドで実行したい場合は @concurrent を付ける
@concurrent
func processImages(_ images: [UIImage]) async -> [UIImage] {
    // 常にグローバルConcurrentExecutorで実行される
    images.map { $0.preparingThumbnail(of: CGSize(width: 100, height: 100))! }
}
```

### nonisolated(nonsending) のデフォルト化（SE-0461）

```swift
// Approachable Concurrency ON の場合、以下は等価
func fetchData() async throws -> Data { ... }
nonisolated(nonsending) func fetchData() async throws -> Data { ... }

// 明示的にバックグラウンド送出したい場合
@concurrent
nonisolated func fetchData() async throws -> Data { ... }
```

### InlineArray（固定サイズ配列）

```swift
// コンパイル時サイズ確定 → スタック割り当てでパフォーマンス向上
let buffer: InlineArray<8, UInt8> = [0, 0, 0, 0, 0, 0, 0, 0]
```

### Span（安全なバッファポインタ代替）

```swift
// UnsafeBufferPointer の安全な代替
func process(data: Data) {
    data.withUnsafeBytes { (span: RawSpan) in
        // span はスコープ外に持ち出せない → メモリ安全
    }
}
```

### Noncopyable Types の強化（SE-0427/0429/0432）

```swift
// リソース安全なプログラミング（Rustの所有権モデルに近い）
struct FileHandle: ~Copyable {
    private let fd: Int32

    consuming func close() {
        Darwin.close(fd)
    }

    deinit {
        Darwin.close(fd)  // consuming前にdeinitされた場合の安全ネット
    }
}
```

### Swift Macros（Swift 6で安定）

```swift
// カスタムマクロで定型コード削減
@freestanding(expression)
macro URL(_ string: String) = #externalMacro(module: "MyMacros", type: "URLMacro")

// 使用例
let url = #URL("https://example.com")  // コンパイル時にURLの有効性チェック
```

---

## 2. SwiftUI — iOS 26 / 2025-2026の主要変更

### @Observable マクロ（iOS 17+、現在の標準）

```swift
// ❌ 旧: ObservableObject + @Published
class UserViewModel: ObservableObject {
    @Published var name = ""
    @Published var isLoading = false
}

// ✅ 新: @Observable（iOS 17+、パフォーマンス向上・依存追跡が自動化）
@Observable
class UserViewModel {
    var name = ""
    var isLoading = false
    // @Published 不要、依存する変数だけ自動的に再描画をトリガー
}

// View側も簡潔に
struct UserView: View {
    var viewModel: UserViewModel  // @StateObject / @ObservedObject 不要

    var body: some View {
        Text(viewModel.name)
    }
}
```

### WebView（iOS 26の新規追加 — UIKitへのフォールバック不要に）

```swift
import SwiftUI
import WebKit

struct ArticleView: View {
    var body: some View {
        WebView(url: URL(string: "https://example.com")!)
            .navigationTitle("記事")
    }
}

// リッチなWeb操作が必要な場合は WebPage モデルを使用
struct AdvancedWebView: View {
    @State private var page = WebPage()

    var body: some View {
        WebView(page)
            .onAppear {
                page.load(URLRequest(url: URL(string: "https://example.com")!))
            }
    }
}
```

### TextEditor でリッチテキスト編集（iOS 26）

```swift
struct NoteEditor: View {
    @State private var text = AttributedString("メモを入力")

    var body: some View {
        TextEditor(text: $text)
            .font(.body)
    }
}
```

### Liquid Glass UI（iOS 26の新デザインシステム）

```swift
// 新デザインに対応するための modifier
struct ToolbarView: View {
    var body: some View {
        NavigationStack {
            ContentView()
                .navigationTitle("ホーム")
                // Liquid Glassマテリアルが自動適用される
                // 明示的な設定は原則不要（システムが判断）
        }
    }
}
```

### Swift Charts — 3D対応（iOS 26）

```swift
import Charts

struct Revenue3DChart: View {
    let data: [SalesData]

    var body: some View {
        Chart3D(data) { item in
            BarMark(
                x: .value("月", item.month),
                y: .value("売上", item.revenue),
                z: .value("カテゴリ", item.category)
            )
        }
    }
}
```

### NavigationStack（現在の標準）

```swift
// ❌ 非推奨: NavigationView
NavigationView {
    ContentView()
}

// ✅ 推奨: NavigationStack（iOS 16+）
@State private var path = NavigationPath()

NavigationStack(path: $path) {
    ContentView()
        .navigationDestination(for: UserID.self) { id in
            UserDetailView(id: id)
        }
}

// プログラマティックナビゲーション
path.append(userId)
```

### カスタムコンテナ（iOS 18+）

```swift
struct CardContainer<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 12) {
            content
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(radius: 4)
    }
}
```

### アニメーション

```swift
// ✅ 推奨: spring アニメーション
.animation(.spring(duration: 0.4, bounce: 0.3), value: isExpanded)

// ✅ トランジション合成
.transition(.move(edge: .trailing).combined(with: .opacity))

// ✅ SF Symbols アニメーション（iOS 18+）
Image(systemName: "checkmark.circle")
    .symbolEffect(.wiggle, value: triggered)
    .symbolEffect(.rotate, value: isLoading)
    .symbolEffect(.breathe, value: isPulsing)
```

### #Preview マクロ（Xcode 15+、現在の標準）

```swift
// ❌ 旧: PreviewProvider
struct ContentView_Previews: PreviewProvider {
    static var previews: some View { ContentView() }
}

// ✅ 新: #Preview マクロ
#Preview("ライトモード") {
    ContentView()
        .environment(\.colorScheme, .light)
}

#Preview("ダークモード") {
    ContentView()
        .environment(\.colorScheme, .dark)
}

#Preview("データあり") {
    ContentView()
        .modelContainer(previewContainer)
}
```

### TabView（iOS 18+の新API）

```swift
TabView {
    Tab("ホーム", systemImage: "house") {
        HomeView()
    }
    Tab("検索", systemImage: "magnifyingglass") {
        SearchView()
    }
}
// フローティングタブバー + サイドバーへの自動切り替えに対応
```

### SceneKit 非推奨 → RealityKit へ移行

```swift
// ❌ 非推奨（Xcode 26でdeprecated警告）
import SceneKit
let scene = SCNScene()

// ✅ 推奨
import RealityKit
let entity = ModelEntity(mesh: .generateBox(size: 0.1))
```

---

## 3. Swift Concurrency — ベストプラクティス

### 基本パターン早見表

| パターン | 使いどころ |
|---|---|
| `async/await` | あらゆる非同期処理 |
| `async let` | 独立した処理の並列実行 |
| `Task { }` | 同期コンテキストから非同期処理を起動 |
| `TaskGroup` | 動的な並列タスク管理 |
| `actor` | 可変共有状態の保護 |
| `@MainActor` | UI更新・メインスレッド処理 |
| `withCheckedContinuation` | コールバックAPIのラップ |

### Actor の正しい使い方

```swift
// ✅ Actorで共有可変状態を保護
actor BankAccount {
    private var balance: Decimal
    private var transactionHistory: [Transaction] = []

    init(initialBalance: Decimal) {
        self.balance = initialBalance
    }

    func deposit(_ amount: Decimal) {
        balance += amount
        transactionHistory.append(.init(type: .deposit, amount: amount))
    }

    func withdraw(_ amount: Decimal) throws {
        guard balance >= amount else { throw BankError.insufficientFunds }
        balance -= amount
        transactionHistory.append(.init(type: .withdrawal, amount: amount))
    }

    // nonisolated: Actor状態にアクセスしない純粋な処理
    nonisolated func formatCurrency(_ amount: Decimal) -> String {
        "$\(amount)"
    }
}

// 外部からの呼び出しは await が必要
func performTransaction() async throws {
    let account = BankAccount(initialBalance: 1000)
    await account.deposit(500)
    try await account.withdraw(200)
}
```

### Actor Reentrancy に注意

```swift
// ❌ 危険: サスペンション後に状態が変わっている可能性
actor Counter {
    var count = 0

    func incrementBadly() async {
        let current = count
        await Task.yield()  // サスペンション点
        count = current + 1  // 別のincrementが割り込んでいる可能性
    }
}

// ✅ 安全: サスペンションをまたがない操作
actor Counter {
    var count = 0

    func increment() {
        count += 1  // 非同期処理なし → reentrancyなし
    }
}
```

### @MainActor の適切な使用

```swift
// ✅ ViewModelはMainActorで隔離
@MainActor
class ProfileViewModel: ObservableObject {
    var user: User?
    var isLoading = false

    func loadProfile() async {
        isLoading = true
        defer { isLoading = false }

        // ネットワーク処理はMainActorを離れて実行される
        user = try? await userService.fetchProfile()
    }
}

// ✅ UI更新は @MainActor で保証
func updateUI() async {
    let data = await fetchData()  // バックグラウンドで実行
    await MainActor.run {
        self.items = data  // メインスレッドで更新
    }
}
```

### 構造化並行性

```swift
// ✅ async let: 独立した処理を並列化
func loadDashboard() async throws -> Dashboard {
    async let user = userService.fetchUser()
    async let posts = postService.fetchPosts()
    async let stats = analyticsService.fetchStats()

    // すべて並列実行 → 最も遅いものを待つ
    return Dashboard(
        user: try await user,
        posts: try await posts,
        stats: try await stats
    )
}

// ✅ TaskGroup: 動的な並列処理
func processImages(_ urls: [URL]) async throws -> [UIImage] {
    try await withThrowingTaskGroup(of: UIImage.self) { group in
        for url in urls {
            group.addTask {
                let (data, _) = try await URLSession.shared.data(from: url)
                guard let image = UIImage(data: data) else {
                    throw ImageError.invalidData
                }
                return image
            }
        }
        return try await group.reduce(into: []) { $0.append($1) }
    }
}
```

### コールバックAPIのラップ

```swift
// ✅ withCheckedContinuation でレガシーAPIをasync化
func fetchLegacyData() async throws -> Data {
    try await withCheckedThrowingContinuation { continuation in
        LegacyClient.fetch { result in
            switch result {
            case .success(let data):
                continuation.resume(returning: data)
            case .failure(let error):
                continuation.resume(throwing: error)
            }
        }
    }
}
```

### Task のキャンセル

```swift
func download(url: URL) async throws -> Data {
    var request = URLRequest(url: url)

    return try await withTaskCancellationHandler {
        let (data, _) = try await URLSession.shared.data(for: request)
        return data
    } onCancel: {
        // キャンセル時のクリーンアップ
        request.url = nil
    }
}

// キャンセルチェックは長い処理の途中に挿入
func processItems(_ items: [Item]) async throws {
    for item in items {
        try Task.checkCancellation()  // キャンセルされたらCancellationError
        await process(item)
    }
}
```

---

## 4. Swift Testing（Xcode 16+）

### XCTest との比較早見表

| 機能 | XCTest | Swift Testing |
|---|---|---|
| テスト検出 | `test` プレフィックス必須 | `@Test` アトリビュートで任意の関数名 |
| スイート型 | `class: XCTestCase` | `struct`（推奨）、`class`、`actor` |
| アサーション | `XCTAssert...()` ファミリー | `#expect()` と `#require()` マクロ |
| オプショナルアンラップ | `try XCTUnwrap(...)` | `try #require(...)` |
| エラーテスト | `XCTAssertThrowsError` | `#expect(throws:)` |
| 非同期待機 | `XCTestExpectation` + `wait(for:)` | `await confirmation(...)` |
| 並列実行 | オプトイン（マルチプロセス） | デフォルトON（Swift Concurrency内） |
| セットアップ | `setUpWithError()` | `init()` |
| ティアダウン | `tearDownWithError()` | `deinit` |

### 基本的な書き方

```swift
import Testing

// ✅ シンプルなテスト（struct推奨）
struct CalculatorTests {

    @Test("2つの正の整数を足す")
    func addsTwoPositiveIntegers() {
        let calculator = Calculator()
        #expect(calculator.add(2, 3) == 5)
    }

    @Test("負の数を足す")
    func addsNegativeNumbers() {
        let calculator = Calculator()
        #expect(calculator.add(-5, 3) == -2)
    }
}
```

### #expect vs #require

```swift
@Test
func validateUserProfile() throws {
    let profile = UserProfile(name: "Alice", email: "alice@example.com")

    // #expect: 失敗しても続行（複数の失敗を一度に確認できる）
    #expect(profile.name == "Alice")
    #expect(profile.email.contains("@"))

    // #require: 失敗したら即テスト停止（nilアンラップにも使用）
    let user = try #require(profile.toUser())  // nilならテスト失敗
    #expect(user.id != nil)
}
```

### エラーテスト

```swift
@Test
func throwsWhenEmailInvalid() {
    let validator = EmailValidator()

    // Swift 6.1+: #expect(throws:) がエラーを返す
    let error = #expect(throws: ValidationError.self) {
        try validator.validate("invalid-email")
    }
    #expect(error?.message.contains("@") == true)
}

@Test
func doesNotThrowForValidEmail() {
    let validator = EmailValidator()
    #expect(throws: Never.self) {
        try validator.validate("valid@example.com")
    }
}
```

### 非同期テスト

```swift
@Test
func loadsUserProfileAsynchronously() async throws {
    let service = UserService(client: MockHTTPClient())
    let user = try await service.fetchProfile(id: "user-1")

    #expect(user.id == "user-1")
    #expect(!user.name.isEmpty)
}

// confirmation: イベント発火の非同期確認
@Test
func notifiesOnLogin() async throws {
    let authManager = AuthManager()

    await confirmation("ログイン通知が発火する") { confirm in
        authManager.onLogin = { confirm() }
        try await authManager.login(email: "test@example.com", password: "pass")
    }
}
```

### テストスイートの構成

```swift
// @Suite でグループ化
@Suite("認証テスト")
struct AuthTests {

    // init/deinitでセットアップ/ティアダウン
    let mockClient: MockHTTPClient
    let authService: AuthService

    init() {
        mockClient = MockHTTPClient()
        authService = AuthService(client: mockClient)
    }

    @Test("有効な認証情報でログインできる")
    func loginWithValidCredentials() async throws {
        mockClient.stub(response: .success(TokenResponse(token: "abc")))
        let token = try await authService.login(email: "test@test.com", password: "pass123")
        #expect(token == "abc")
    }

    @Test("不正なパスワードで401エラーが返る")
    func loginWithInvalidPasswordReturns401() async throws {
        mockClient.stub(response: .failure(HTTPError.unauthorized))
        #expect(throws: HTTPError.unauthorized) {
            try await authService.login(email: "test@test.com", password: "wrong")
        }
    }
}
```

### パラメタライズドテスト

```swift
@Test("メールアドレスのバリデーション",
      arguments: [
          ("valid@example.com", true),
          ("invalid-email", false),
          ("@nodomain.com", false),
          ("user@.com", false),
      ])
func emailValidation(email: String, isValid: Bool) throws {
    let validator = EmailValidator()
    if isValid {
        #expect(throws: Never.self) { try validator.validate(email) }
    } else {
        #expect(throws: (any Error).self) { try validator.validate(email) }
    }
}
```

### XCTestとの共存・移行ルール

- XCTest と Swift Testing は同一ターゲットに混在可能
- 同一ファイルでの混在も可能（移行を段階的に進められる）
- **移行しないもの:** UIオートメーションテスト（`XCUIApplication`）、パフォーマンステスト（`XCTMetric`）、Objective-Cテスト

---

## 5. Xcode 26 の主要機能

### Explicitly Built Modules（Swift対応、デフォルトON）

```
ビルドフェーズ: Scan → Build Modules → Build Sources
利点: ビルド並列性向上、デバッグ速度向上（debuggerがmoduleを再利用）

無効化（問題発生時のみ）:
SWIFT_ENABLE_EXPLICIT_MODULES = NO
```

### AI コーディングアシスタント

- ChatGPT（組み込み）、Claude、Ollama など複数LLMに対応
- コードベースを理解してインラインで修正提案
- Apple silicon + macOS Tahoe + Apple Intelligence 必須

### Swift Concurrencyデバッガー強化

- async関数への実行追跡（スキップなし）
- タスクIDの表示
- Concurrency型の読みやすい表示

### #Playground マクロ（UI以外のコードでもPlayground）

```swift
// UI不要なコードをインラインでプレビュー
#Playground {
    let numbers = [1, 2, 3, 4, 5]
    let doubled = numbers.map { $0 * 2 }
    // Xcode上でdoubled の値がリアルタイム表示
}
```

### パフォーマンス計測ツール（新規）

- **Processor Trace**: M4/iPhone 16でCPUブランチ追跡（低オーバーヘッド）
- **CPU Counters**: ボトルネック特定
- **SwiftUI Instrument**: データ変化とView更新の可視化

### Icon Composer

- Liquid Glass対応の多層アイコン作成ツール
- iPhone/iPad/Mac/Apple Watch 全対応
- Xcode 26に同梱

---

## 非推奨・廃止されたAPI / 書き方

| 非推奨 | 移行先 | 時期 |
|---|---|---|
| `ObservableObject` + `@Published` | `@Observable` マクロ | iOS 17+で推奨 |
| `NavigationView` | `NavigationStack` / `NavigationSplitView` | iOS 16+で推奨 |
| `WKWebView` を UIKit でラップ | SwiftUI `WebView` | iOS 26+ |
| `DispatchQueue.main.async` | `await MainActor.run { }` | Swift Concurrency移行後 |
| `DispatchQueue.global().async` | `Task { }` / `@concurrent` | Swift Concurrency移行後 |
| `SceneKit` | `RealityKit` | Xcode 26でdeprecated |
| `@UIApplicationDelegateAdaptor` の多用 | SwiftUI App lifecycle | 段階的移行 |
| `PreviewProvider` | `#Preview` マクロ | Xcode 15+で推奨 |
| `XCTAssertEqual` など | `#expect()` / `#require()` | Xcode 16+で推奨 |
| GCDの `DispatchGroup` | `async let` / `TaskGroup` | Swift Concurrency移行後 |

---

## アーキテクチャパターン

### 推奨: @Observable + SwiftUI（2026年現在の標準）

```swift
// Model Layer
@Observable
class UserStore {
    var users: [User] = []
    var isLoading = false
    var error: Error?

    private let service: UserService

    init(service: UserService = .live) {
        self.service = service
    }

    func loadUsers() async {
        isLoading = true
        defer { isLoading = false }

        do {
            users = try await service.fetchAll()
        } catch {
            self.error = error
        }
    }
}

// View Layer
struct UserListView: View {
    @State private var store = UserStore()

    var body: some View {
        Group {
            if store.isLoading {
                ProgressView()
            } else {
                List(store.users) { user in
                    UserRow(user: user)
                }
            }
        }
        .task {
            await store.loadUsers()
        }
        .alert("エラー", isPresented: .constant(store.error != nil)) {
            Button("OK") { store.error = nil }
        } message: {
            Text(store.error?.localizedDescription ?? "")
        }
    }
}
```

### 依存性注入パターン

```swift
// プロトコルで抽象化
protocol UserServiceProtocol {
    func fetchAll() async throws -> [User]
}

// 本番実装
struct LiveUserService: UserServiceProtocol {
    func fetchAll() async throws -> [User] {
        let (data, _) = try await URLSession.shared.data(from: URL(string: "/api/users")!)
        return try JSONDecoder().decode([User].self, from: data)
    }
}

// テスト用モック
struct MockUserService: UserServiceProtocol {
    var users: [User] = []
    var shouldThrow = false

    func fetchAll() async throws -> [User] {
        if shouldThrow { throw URLError(.notConnectedToInternet) }
        return users
    }
}
```

---

## パフォーマンスガイドライン（iOS固有）

- `useCallback` / `useMemo` 相当は `@Observable` の自動依存追跡で代替（手動最適化は計測後）
- 大きなリストは `LazyVStack` + `List` の仮想化を活用
- 画像は `AsyncImage` または `Image(uiImage:)` + バックグラウンドデコード
- `useFrame` 相当（毎フレーム更新）は `TimelineView` で管理
- `@concurrent` でCPU集約処理をオフロード（UIスレッドブロック禁止）
- メインスレッドで重い処理をしない — `EXPLAIN ANALYZE` 相当は Instruments の Time Profiler で確認
