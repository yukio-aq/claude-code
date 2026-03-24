---
description: Kotlin 2.3 / Jetpack Compose 1.10 / AGP 9.1 のベストプラクティス（2026年版）。android-implementer / android-reviewer が参照する。
---

# Android — Kotlin / Jetpack Compose ベストプラクティス

> 情報収集日: 2026-03-23 / Kotlin 2.3.20 + Compose 1.10.5 + AGP 9.1.0 ベース
> JDK 17 / Gradle 9.3.1 / minSdk 26 を前提

## 2026年時点の推奨スタック

```
言語:           Kotlin 2.3.20
UI:             Jetpack Compose 1.10.5（BOM管理）
デザイン:        Material3 1.4.0
アーキテクチャ:   MVVM + Clean Architecture
状態管理:        StateFlow + collectAsStateWithLifecycle
DI:             Hilt（KSPでコンパイル）
ナビゲーション:   Navigation 3（type-safe routes）
ビルドシステム:   AGP 9.1.0 + Gradle 9.3.1 + JDK 17
注釈処理:        KSP（kaptからの移行完了）
テスト:          JUnit4 + MockK + kotlinx-coroutines-test
```

---

## Gradle設定（AGP 9.1.0 + Kotlin 2.3.20）

```toml
# gradle/libs.versions.toml
[versions]
kotlin = "2.3.20"
agp = "9.1.0"
compose-bom = "2026.03.00"
hilt = "2.55"
lifecycle = "2.9.0"
navigation3 = "1.0.0"

[libraries]
compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
compose-ui = { group = "androidx.compose.ui", name = "ui" }
compose-material3 = { group = "androidx.compose.material3", name = "material3" }
lifecycle-runtime-compose = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-android-compiler", version.ref = "hilt" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp = { id = "com.google.devtools.ksp", version = "2.3.20-1.0.31" }
```

```kotlin
// build.gradle.kts（AGP 9.1.0）
plugins {
    alias(libs.plugins.android.application)
    // AGP 9.0+: org.jetbrains.kotlin.android プラグインは不要（Built-in Kotlin）
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)  // kapt → KSP（高速・推奨）
}

android {
    compileSdk = 36
    defaultConfig {
        minSdk = 26
        targetSdk = 36
    }
    buildFeatures { compose = true }
}

dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)  // ❌ kapt → ✅ ksp
}
```

---

## Kotlin 2.2+ の新機能

### Guard Conditions in When（Stable）

```kotlin
sealed class Response<T>
data class Success<T>(val data: T) : Response<T>()
data class Failure<T>(val error: String) : Response<T>()

fun handleResponse(response: Response<User>) = when (response) {
    is Success<User> if response.data.isAdmin -> "Admin: ${response.data.name}"
    is Success<User> -> "User: ${response.data.name}"
    is Failure -> "Error: ${response.error}"
}
```

### Context Parameters（Kotlin 2.2でBeta）

旧 Context Receivers は Kotlin 2.3 で削除。

```kotlin
// ✅ 新: Context Parameters
interface Logger { fun info(msg: String) }

context(logger: Logger)
fun processUser(userId: String) {
    logger.info("Processing user: $userId")
}

// ❌ 旧: Context Receivers（2.3で削除）
context(Logger)
fun oldStyle() { info("NG") }
```

---

## ViewModel パターン（推奨）

```kotlin
// ✅ 単一 uiState StateFlow パターン
@HiltViewModel
class BookmarksViewModel @Inject constructor(
    private val newsRepository: NewsRepository
) : ViewModel() {

    val uiState: StateFlow<BookmarksUiState> =
        newsRepository
            .getNewsResourcesStream()
            .map { resources ->
                if (resources.isEmpty()) BookmarksUiState.Empty
                else BookmarksUiState.Success(resources)
            }
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5_000),  // 公式推奨値
                initialValue = BookmarksUiState.Loading
            )
}

sealed interface BookmarksUiState {
    data object Loading : BookmarksUiState
    data object Empty : BookmarksUiState
    data class Success(val resources: List<NewsResource>) : BookmarksUiState
    data class Error(val message: String) : BookmarksUiState
}
```

**WhileSubscribed(5_000) を使う理由:**
- 画面が5秒以上バックグラウンドに入ったらFlowの収集を停止
- 設定変更（画面回転）では収集が継続される（5秒以内に復帰するため）

---

## Compose パターン（推奨）

```kotlin
// ✅ Route-level ViewModel パターン（公式推奨）
// ViewModelはルートComposableにのみ渡す。子コンポーネントに直接渡さない。
@Composable
fun UserProfileRoute(viewModel: UserProfileViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()  // ✅（not collectAsState）

    UserProfileScreen(
        uiState = uiState,
        onFollowUser = viewModel::followUser,
    )
}

// ✅ 子Composableは純粋なデータとコールバックを受け取る（Previewが作りやすい）
@Composable
fun UserProfileScreen(
    uiState: UserProfileUiState,
    onFollowUser: (String) -> Unit,
    modifier: Modifier = Modifier,  // Modifier引数は常に最後に
) {
    // ViewModelへの直接依存なし
}
```

```kotlin
// ✅ collectAsStateWithLifecycle（必須）
// NG: collectAsState() — ライフサイクルを考慮せずバックグラウンドでも動く
val state by viewModel.uiState.collectAsState()       // ❌
val state by viewModel.uiState.collectAsStateWithLifecycle()  // ✅
```

---

## Compose 1.10 の主要変更

### Pausable Composition（デフォルト有効）

Compose 1.10 の最大のパフォーマンス改善。特別な対応コードは不要。

```
以前: composition開始 → 完了まで実行（フレームをブロックする可能性）
以後: composition開始 → フレーム時間が足りなければ一時停止 → 次フレームで再開
内部ベンチマーク: Viewsと同等のスクロール性能を達成
```

### Compose Hot Reload 1.0.0

アプリ再起動なしにUI変更を即時反映。Android Studio Meerkat以降で使用可能。

### Visibility Tracking

```kotlin
@Composable
fun VideoItem(videoUrl: String) {
    var isPlaying by remember { mutableStateOf(false) }

    VideoPlayer(
        url = videoUrl,
        isPlaying = isPlaying,
        modifier = Modifier.onVisibilityChanged { isVisible ->
            isPlaying = isVisible
        }
        // ※ Modifier.onFirstVisible は 1.11 で非推奨 → onVisibilityChanged を使う
    )
}
```

### LazyList プリフェッチ制御

```kotlin
@OptIn(ExperimentalFoundationApi::class)
val cacheWindow = LazyLayoutCacheWindow(
    ahead = 150.dp,
    behind = 100.dp
)

LazyColumn(state = rememberLazyListState(cacheWindow = cacheWindow)) {
    items(items) { ItemCard(it) }
}
```

---

## Material3 テーマ設定

```kotlin
@Composable
fun AppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(colorScheme = colorScheme, typography = Typography, content = content)
}
```

---

## Navigation 3（型安全ルート）

```kotlin
@Serializable data object Home : NavKey
@Serializable data class Detail(val id: String) : NavKey

@Composable
fun AppNavigation() {
    val backStack = rememberNavBackStack(Home)

    NavDisplay(
        backStack = backStack,
        entryDecorators = listOf(
            rememberSaveableStateHolderNavEntryDecorator(),
            rememberViewModelStoreNavEntryDecorator()
        ),
        entryProvider = entryProvider {
            entry<Home> {
                HomeScreen(onNavigate = { id -> backStack.add(Detail(id)) })
            }
            entry<Detail> { key ->
                val viewModel = hiltViewModel<DetailViewModel, DetailViewModel.Factory> { factory ->
                    factory.create(key.id)
                }
                DetailScreen(viewModel = viewModel)
            }
        }
    )
}
```

---

## Coroutines / Flow パターン

```kotlin
// 複数の並列リクエスト
suspend fun loadDashboard(userId: String): Dashboard = coroutineScope {
    val profile = async { userRepository.getProfile(userId) }
    val posts = async { postRepository.getPosts(userId) }
    val stats = async { statsRepository.getStats(userId) }

    Dashboard(profile.await(), posts.await(), stats.await())
}

// 検索フィールドのdebounce
val searchResults: StateFlow<List<SearchResult>> = searchQuery
    .debounce(300)
    .filter { it.length >= 2 }
    .distinctUntilChanged()
    .flatMapLatest { searchRepository.search(it) }
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

// 複数Flowの結合
val uiState = combine(
    userRepository.currentUser,
    notificationsRepository.unreadCount,
) { user, count ->
    DashboardUiState(user = user, unreadCount = count)
}.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DashboardUiState.Loading)
```

---

## テスト

```kotlin
class UserViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `should emit loading then success`() = runTest {
        val fakeRepository = FakeUserRepository()
        val viewModel = UserViewModel(fakeRepository)

        val states = mutableListOf<UserUiState>()
        val job = launch { viewModel.uiState.toList(states) }

        viewModel.fetchUser("123")
        advanceUntilIdle()

        assertThat(states).containsExactly(
            UserUiState.Loading,
            UserUiState.Success(fakeUser)
        ).inOrder()

        job.cancel()
    }
}
```

---

## 非推奨・廃止一覧

| 項目 | 状況 | 移行先 |
|---|---|---|
| `context(Type)` Context Receivers | **Kotlin 2.3で削除** | `context(name: Type)` Context Parameters |
| `org.jetbrains.kotlin.android` プラグイン | AGP 9.0で不要 | Built-in Kotlin（AGP自動） |
| `kapt` | 非推奨 | `KSP` |
| `collectAsState()` | 非推奨パターン | `collectAsStateWithLifecycle()` |
| `Modifier.onFirstVisible` | Compose 1.11で非推奨 | `Modifier.onVisibilityChanged` |
| `GlobalScope` | 禁止 | `viewModelScope` / `lifecycleScope` |
| `LiveData`（新規） | 非推奨パターン | `StateFlow` |
| Navigation 2 の文字列ルート | 非推奨パターン | Type-safe routes（`@Serializable`） |
