---
description: Kotlin/Jetpack ComposeのAndroidコーディングスタンダード。android-implementer / android-reviewer が参照する。
---

# Android コーディングスタンダード（Kotlin / Jetpack Compose）

## アーキテクチャ（MVVM + Repository）

```kotlin
// UiState: immutableなデータクラス
data class UserListUiState(
  val users: List<User> = emptyList(),
  val isLoading: Boolean = false,
  val error: String? = null,
)

// ViewModel: 単方向データフロー
@HiltViewModel
class UserListViewModel @Inject constructor(
  private val userRepository: UserRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(UserListUiState())
  val uiState: StateFlow<UserListUiState> = _uiState.asStateFlow()

  init { fetchUsers() }

  fun fetchUsers() {
    viewModelScope.launch {
      _uiState.update { it.copy(isLoading = true, error = null) }
      userRepository.getUsers()
        .onSuccess { users -> _uiState.update { it.copy(users = users, isLoading = false) } }
        .onFailure { e -> _uiState.update { it.copy(error = e.message, isLoading = false) } }
    }
  }
}
```

## Compose のルール

```kotlin
// ✅ Modifierは引数で受け取る（再利用性を保つ）
@Composable
fun UserCard(
  user: User,
  onDelete: (String) -> Unit,
  modifier: Modifier = Modifier,  // デフォルト値を持たせる
) {
  Card(modifier = modifier) { ... }
}

// ✅ 副作用はLaunchedEffectで管理
@Composable
fun UserListScreen(viewModel: UserListViewModel = hiltViewModel()) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()

  LaunchedEffect(uiState.error) {
    uiState.error?.let { showSnackbar(it) }
  }
}
```

## ライフサイクル管理

```kotlin
// ✅ repeatOnLifecycleでFlowを収集（バックグラウンド時は停止）
lifecycleScope.launch {
  repeatOnLifecycle(Lifecycle.State.STARTED) {
    viewModel.uiState.collect { uiState -> /* update UI */ }
  }
}

// ❌ 直接collectするとバックグラウンドでも動き続ける
lifecycleScope.launch {
  viewModel.uiState.collect { uiState -> /* NG */ }
}
```

## Material Design準拠チェックリスト

- `MaterialTheme.colorScheme` を使う（ハードコードしない）
- ダイナミックカラー（Android 12+）に対応する
- タッチターゲットは最小48dp
- `WindowInsets` を考慮してエッジツーエッジに対応する
