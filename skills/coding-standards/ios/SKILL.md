---
name: ios
description: Swift/SwiftUIのiOSコーディングスタンダード。ios-implementer / ios-reviewer が参照する。
---

# iOS コーディングスタンダード（Swift / SwiftUI）

> 情報収集日: 2026-03-31

## アーキテクチャ（MVVM）

```swift
// ✅ ViewはUIのみ、ロジックはViewModelに分離
struct UserListView: View {
  @StateObject private var viewModel = UserListViewModel()

  var body: some View {
    Group {
      if viewModel.isLoading {
        ProgressView()
      } else {
        List(viewModel.users) { user in
          UserRowView(user: user)
        }
      }
    }
    .task { await viewModel.fetchUsers() }
  }
}

@MainActor
final class UserListViewModel: ObservableObject {
  @Published var users: [User] = []
  @Published var isLoading = false
  @Published var errorMessage = ""
  @Published var hasError = false

  func fetchUsers() async {
    isLoading = true
    defer { isLoading = false }
    do {
      users = try await userService.fetchAll()
    } catch {
      errorMessage = error.localizedDescription
      hasError = true
    }
  }
}
```

## メモリ管理

```swift
// ✅ クロージャ内の循環参照を防ぐ
class NetworkManager {
  var completion: ((Result<Data, Error>) -> Void)?

  func fetch(url: URL) {
    URLSession.shared.dataTask(with: url) { [weak self] data, _, error in
      guard let self else { return }
      // selfを安全に使用
    }.resume()
  }

  deinit {
    // リソースの解放
    completion = nil
  }
}
```

## @StateObject / @ObservedObject の使い分け

```swift
// @StateObject: そのViewがViewModelのオーナー（rootで生成）
struct ParentView: View {
  @StateObject private var viewModel = UserViewModel()
  var body: some View {
    ChildView(viewModel: viewModel)
  }
}

// @ObservedObject: 外から渡されたViewModelを参照
struct ChildView: View {
  @ObservedObject var viewModel: UserViewModel
}
```

## HIG準拠チェックリスト

- タップターゲットは最小44×44pt
- システムフォント（`.body`, `.headline`等）を使う
- ダークモードに対応する（`Color` のセマンティックカラーを使う）
- Dynamic Typeに対応する（固定フォントサイズを使わない）
- セーフエリアを考慮する（`.ignoresSafeArea` の過剰使用を避ける）
