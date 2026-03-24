---
description: Playwright E2Eテストのベストプラクティス（バージョン・POM・APIテスト統合・CI/CD・モバイル・コンポーネントテスト使い分け）。qa-engineer / test-implementer / *-reviewer が参照する。
---

# Playwright E2E テスト ベストプラクティス

> 調査日: 2026-03-23 / 対象バージョン: Playwright 1.58.x（2026年3月時点最新）

---

## バージョンと主要変更履歴（2025〜2026）

| バージョン | リリース時期 | 主な変更 |
|---|---|---|
| 1.48〜1.50 | 2024年末〜2025年初 | ネットワークリクエストフィルタリング改善、テキストキャッシュによる最大8倍の高速化 |
| 1.51〜1.54 | 2025年前半 | Trace Viewer 強化、UI Mode 改善、Debian 13 "Trixie" CI サポート |
| 1.55〜1.56 | 2025年後半 | **Playwright Test Agents 導入**（planner / generator / healer ループ）、MCP サーバー統合 |
| 1.57 | 2025年末〜2026年初 | Speedboard タブ（スイートレベルのパフォーマンス可視化） |
| 1.58 | 2026年2〜3月 | HTML レポートに **Timeline ビュー**追加、待ち時間・ボトルネック・回帰を可視化 |

### 注目点
- **Chrome Extension Manifest v2 サポート終了**。拡張機能を使うテストは Manifest v3 に移行必須
- **AI Test Agents**（1.56〜）: `specs/` ディレクトリに Markdown で意図を記述 → エージェントがテストコードを生成・修正
- **Playwright MCP Server**: AI エージェントから `browser_click` / `browser_navigate` 等を直接呼び出せる構造化レイヤー

---

## 1. ロケーター戦略（最重要）

壊れにくいセレクターを選ぶ優先順位:

```
1. getByRole()        ← アクセシビリティファーストで最も堅牢
2. getByLabel()       ← フォーム要素
3. getByText()        ← 一意なテキスト
4. getByTestId()      ← data-testid 属性（動的 UI 向け）
5. locator('css')     ← 最後の手段。深い DOM チェーンは禁止
```

```typescript
// ✅ 良い例
await page.getByRole('button', { name: '注文確定' }).click();
await page.getByLabel('メールアドレス').fill('user@example.com');
await page.getByTestId('cart-count').toHaveText('1');

// ❌ 悪い例: 内部実装に依存
await page.locator('#app > div.main > ul > li:nth-child(2) > button').click();
```

---

## 2. Page Object Model（POM）

### 基本構造

```typescript
// tests/pages/BasePage.ts
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async navigate(path: string): Promise<void> {
    await this.page.goto(`${process.env.BASE_URL}${path}`);
    await this.waitForReady();
  }
}
```

```typescript
// tests/pages/LoginPage.ts
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  // ロケーターはクラス内に集約（変更時に1箇所だけ直す）
  private readonly emailInput = this.page.getByLabel('メールアドレス');
  private readonly passwordInput = this.page.getByLabel('パスワード');
  private readonly submitButton = this.page.getByRole('button', { name: 'ログイン' });
  private readonly errorMessage = this.page.getByTestId('auth-error');

  async goto(): Promise<void> {
    await this.navigate('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async getErrorMessage(): Promise<string> {
    return this.errorMessage.textContent() ?? '';
  }
}
```

```typescript
// tests/pages/DashboardPage.ts
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  private readonly welcomeHeading = this.page.getByRole('heading', { level: 1 });

  async isLoaded(): Promise<boolean> {
    return this.welcomeHeading.isVisible();
  }
}
```

### POM のルール
- **アサーションはテストに書く / POМ は操作のみ**。`expect()` を POM メソッド内に書かない
- **共通 UI（ヘッダー・モーダル）はコンポーネントクラス**として切り出し、POM に合成する
- 1ファイル1クラス。`tests/pages/` ディレクトリに集約する

---

## 3. テストの基本構造

```typescript
// tests/auth/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('ログイン', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.goto();
  });

  test('should redirect to dashboard when credentials are valid', async () => {
    await loginPage.login('user@example.com', 'password123');
    await expect(dashboardPage.isLoaded()).resolves.toBe(true);
    await expect(loginPage.page).toHaveURL(/\/dashboard/);
  });

  test('should show error message when password is incorrect', async () => {
    await loginPage.login('user@example.com', 'wrong-password');
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('メールアドレスまたはパスワードが違います');
  });

  test('should show error message when email format is invalid', async () => {
    await loginPage.login('not-an-email', 'password123');
    await expect(loginPage.page.getByTestId('auth-error')).toBeVisible();
  });
});
```

### テスト分離・独立性の確保

```typescript
// 認証状態の再利用（ログインを毎テストで繰り返さない）
// tests/auth.setup.ts
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel('パスワード').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL('/dashboard');
  // ストレージ状態を保存（以降のテストで再利用）
  await page.context().storageState({ path: '.auth/user.json' });
});
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,       // CI で .only() が混入したらビルド失敗
  retries: process.env.CI ? 2 : 0,    // CI のみリトライ
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'report.json' }],
    ['junit', { outputFile: 'results.xml' }],  // CI ダッシュボード向け
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',         // 失敗時のみトレースを取得（ストレージ節約）
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // セットアップ（ログイン状態を生成）
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    // デスクトップ
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
    // モバイルエミュレーション
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14 Pro'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});
```

---

## 4. APIテストとの組み合わせ

### セットアップを API 経由で行う（UI セットアップを避ける）

```typescript
// tests/fixtures/api.ts
import { test as base, APIRequestContext } from '@playwright/test';

type Fixtures = {
  apiContext: APIRequestContext;
};

export const test = base.extend<Fixtures>({
  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: process.env.API_BASE_URL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${process.env.TEST_API_TOKEN}`,
      },
    });
    await use(context);
    await context.dispose();
  },
});
```

```typescript
// tests/orders/order-flow.spec.ts
import { test } from '../fixtures/api';
import { expect } from '@playwright/test';

test.describe('注文フロー', () => {
  let orderId: string;

  test.beforeEach(async ({ apiContext }) => {
    // UI を使わず API でテストデータを準備（高速・安定）
    const response = await apiContext.post('/api/orders', {
      data: { items: [{ productId: 'prod-1', quantity: 2 }] },
    });
    const { data } = await response.json();
    orderId = data.id;
  });

  test.afterEach(async ({ apiContext }) => {
    // テスト後のクリーンアップも API 経由
    await apiContext.delete(`/api/orders/${orderId}`);
  });

  test('should complete checkout flow', async ({ page, apiContext }) => {
    await page.goto(`/orders/${orderId}`);
    await page.getByRole('button', { name: '注文確定' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('確定済み');

    // UI の表示確認後、API でバックエンドへの反映も検証
    const res = await apiContext.get(`/api/orders/${orderId}`);
    const { data } = await res.json();
    expect(data.status).toBe('CONFIRMED');
  });
});
```

### ネットワークのモック・インターセプト

```typescript
test('should show error state when API fails', async ({ page }) => {
  // 特定のエンドポイントをモック
  await page.route('/api/orders/**', (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: { code: 'INTERNAL_SERVER_ERROR' } }),
    });
  });

  await page.goto('/orders');
  await expect(page.getByTestId('error-banner')).toBeVisible();
});

test('should handle slow network gracefully', async ({ page }) => {
  // ネットワーク遅延をシミュレート
  await page.route('/api/orders', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });

  await page.goto('/orders');
  // ローディング状態が表示されることを確認
  await expect(page.getByTestId('loading-skeleton')).toBeVisible();
});
```

---

## 5. E2E でテストすべきこと・すべきでないこと

### テストすべきクリティカルフロー（E2E の対象）

| カテゴリ | 具体例 |
|---|---|
| 認証 | ログイン・ログアウト・セッション切れ・MFA |
| 決済 | カート→チェックアウト→注文完了の一連フロー |
| 主要 CRUD | ユーザー登録→プロフィール編集→退会 |
| 権限制御 | 一般ユーザーが管理者ページにアクセスできないこと |
| フォーム送信 | バリデーションエラー・正常送信・二重送信防止 |
| ナビゲーション | ルーティング・ブラウザ戻る操作・ディープリンク |

### E2E でテストしてはいけないこと

```typescript
// ❌ E2E でやらないこと
// - 入力バリデーションの全パターン（Unit Test で網羅する）
// - UI コンポーネントの表示バリエーション（Component Test で行う）
// - API のレスポンスの詳細検証（Integration Test で行う）
// - エラーメッセージの文言（Unit Test で行う）
// - ビジネスロジックの計算結果（Unit Test で行う）
```

```
テストピラミッドの役割分担:

        E2E（少数）    ← クリティカルなユーザーフロー（認証・決済・主要導線）
       Integration     ← APIエンドポイント・DB・外部サービス連携
    Unit（多数・高速） ← ビジネスロジック・ユーティリティ・バリデーション
```

---

## 6. CI/CD 統合（GitHub Actions）

### 基本ワークフロー

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    container:
      image: mcr.microsoft.com/playwright:latest  # ブラウザ同梱イメージで依存解決を省略

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run E2E tests
        run: npx playwright test
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
          TEST_API_TOKEN: ${{ secrets.TEST_API_TOKEN }}
          CI: true

      - name: Upload test report
        if: always()  # 失敗時も必ずアップロード
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

      - name: Upload traces on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces
          path: test-results/
          retention-days: 7
```

### シャーディング（大規模スイート向け）

```yaml
# 500件以上のテストは複数マシンに分散
jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - run: npx playwright test --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: blob-report-${{ matrix.shard }}
          path: blob-report/

  merge-report:
    needs: e2e
    runs-on: ubuntu-latest
    if: always()
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with:
          name: merged-html-report
          path: playwright-report/
```

### 推奨設定のポイント

| 設定 | 理由 |
|---|---|
| `retries: 2` (CI のみ) | フレーキーテストの一時的失敗を吸収。ただし 2% 超えたら根本原因を調査 |
| `workers: 4` (CI) | 並列実行で時間短縮。最初は 1 で安定させてからスケールアップ |
| `trace: 'on-first-retry'` | 失敗時のみトレースを取得してストレージを節約 |
| `forbidOnly: !!process.env.CI` | `.only()` がコミットに混入してもビルドで検出 |
| `mcr.microsoft.com/playwright:latest` | ブラウザ同梱イメージで `npx playwright install` 不要 |

---

## 7. レポーティング

```typescript
// playwright.config.ts - マルチレポーター設定
reporter: [
  // ローカル: インタラクティブな HTML レポート（1.57〜 Speedboard タブで遅いテストを可視化）
  ['html', { outputFolder: 'playwright-report', open: 'never' }],
  // CI: JUnit 形式（GitHub Actions / Jenkins ダッシュボードで表示可能）
  ['junit', { outputFile: 'results.xml' }],
  // プログラム処理: JSON（カスタムダッシュボードや Slack 通知に利用）
  ['json', { outputFile: 'report.json' }],
],
```

### Speedboard / Timeline の活用（1.57〜1.58）

```bash
# ローカルでレポートを開く
npx playwright show-report

# Speedboard タブ: テストスイート全体の実行時間分析
# Timeline ビュー（1.58〜）: どのテストがどのタイミングで実行されたか可視化
# → 待ち時間・ボトルネック・回帰を特定
```

### テストタグによるフィルタリング

```typescript
// テストにタグを付与
test('should complete checkout @smoke @critical', async ({ page }) => { ... });
test('should display product list @regression', async ({ page }) => { ... });
```

```bash
# タグでフィルタリング実行
npx playwright test --grep @smoke        # スモークテストのみ（PR毎に実行）
npx playwright test --grep @critical     # クリティカルパスのみ
npx playwright test --grep-invert @slow  # 遅いテストを除外
```

---

## 8. モバイルテスト

### Playwright でできること・できないこと

| 対象 | Playwright | 推奨代替 |
|---|---|---|
| モバイルウェブ（Chrome/Safari エミュレーション） | ✅ 対応 | — |
| レスポンシブデザイン検証 | ✅ 対応 | — |
| タッチ操作（tap / swipe / pinch） | ✅ 対応 | — |
| Android Chrome（実機 via ADB） | 実験的サポート | — |
| iOS ネイティブアプリ | ❌ 非対応（Apple 制限） | XCTest / Detox |
| Android ネイティブアプリ | ❌ 非対応 | Espresso / Appium |
| ハイブリッドアプリ（React Native等） | ❌ 非対応 | Detox / Appium |

### モバイルウェブのテスト

```typescript
// playwright.config.ts - デバイスプロファイル設定
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    // デスクトップ
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    // モバイルエミュレーション（プリセット多数: iPhone SE〜15 Pro Max, Pixel 7 等）
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 14 Pro'] } },
    // タブレット
    { name: 'Tablet', use: { ...devices['iPad Pro 11'] } },
  ],
});
```

```typescript
// タッチ操作のテスト
test('should swipe carousel on mobile', async ({ page }) => {
  await page.goto('/products');
  const carousel = page.getByTestId('product-carousel');

  // スワイプ操作
  await carousel.dispatchEvent('touchstart', { touches: [{ clientX: 300, clientY: 200 }] });
  await carousel.dispatchEvent('touchmove',  { touches: [{ clientX: 100, clientY: 200 }] });
  await carousel.dispatchEvent('touchend',   { touches: [] });

  await expect(page.getByTestId('carousel-slide-2')).toBeVisible();
});
```

### ハイブリッドアプローチの推奨

```
モバイルテスト戦略:
  1. Playwright エミュレーション  → レスポンシブ・モバイルウェブの基本動作（高速・安定）
  2. BrowserStack / Sauce Labs   → 実機デバイスでのクロスブラウザ確認（クリティカルフローのみ）
  3. Detox / Appium              → ネイティブ・ハイブリッドアプリの E2E（別スタックで管理）
```

---

## 9. コンポーネントテスト vs フル E2E の使い分け

### Playwright コンポーネントテスト

```typescript
// tests/components/Button.spec.tsx （@playwright/experimental-ct-react）
import { test, expect } from '@playwright/experimental-ct-react';
import { Button } from '../../src/components/Button';

test('should show loading spinner when loading prop is true', async ({ mount }) => {
  const component = await mount(<Button loading={true}>送信</Button>);
  await expect(component.getByTestId('spinner')).toBeVisible();
  await expect(component).toBeDisabled();
});

test('should call onClick when clicked', async ({ mount }) => {
  let clicked = false;
  const component = await mount(<Button onClick={() => { clicked = true; }}>クリック</Button>);
  await component.click();
  expect(clicked).toBe(true);
});
```

### 使い分けの判断基準

| 観点 | Vitest + Testing Library | Playwright コンポーネントテスト | Playwright フル E2E |
|---|---|---|---|
| **実行速度** | 最速（msec） | 中速（数秒） | 最遅（数十秒〜） |
| **対象** | ロジック・レンダリング | 実ブラウザでのコンポーネント動作 | ユーザーフロー全体 |
| **向いているケース** | 純粋な計算・状態管理・イベント | アニメーション・CSS・実ブラウザ依存の動作 | 認証・決済・ページ遷移 |
| **ネットワーク** | MSW でモック | ルートハンドラでモック | 本物 or APIモック |
| **推奨割合** | 多（70%以上） | 少（UI コンポーネントライブラリ開発時） | 少（クリティカルフローのみ） |

### 決定フローチャート

```
テストを書こうとしているのは...

├── ビジネスロジック・計算・バリデーション
│   └── → Vitest（Unit Test）
│
├── React コンポーネントの振る舞い
│   ├── ブラウザ依存（CSS animation・scroll・実DOM）
│   │   └── → Playwright Component Test
│   └── それ以外
│       └── → Vitest + Testing Library
│
└── ユーザーフロー（複数ページをまたぐ操作）
    ├── 認証・決済・主要導線
    │   └── → Playwright E2E（必須）
    └── その他の画面遷移
        └── → Integration Test で代替を検討
```

---

## 10. よくあるアンチパターン

```typescript
// ❌ 固定 sleep を使う（フレーキーの温床）
await page.waitForTimeout(3000);

// ✅ web-first アサーション（自動リトライ付き）
await expect(page.getByTestId('success-message')).toBeVisible();
await expect(page).toHaveURL(/\/dashboard/);

// ❌ テスト間でデータを共有する
let userId: string; // beforeAll で生成して全テストで使い回す → テスト順序依存

// ✅ 各テストで独立したデータを用意する（API 経由で高速セットアップ）
test.beforeEach(async ({ apiContext }) => {
  const res = await apiContext.post('/api/users', { data: buildUser() });
  userId = (await res.json()).data.id;
});

// ❌ UI でログインを毎テスト繰り返す
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'user@example.com');
  await page.fill('#password', 'password');
  await page.click('#submit');
});

// ✅ storageState で認証状態を再利用
// playwright.config.ts の use.storageState に .auth/user.json を指定

// ❌ POM の中にアサーションを書く
async clickLogin(): Promise<void> {
  await this.submitButton.click();
  await expect(this.page).toHaveURL('/dashboard'); // POM にアサーションは書かない
}

// ✅ POM はアクションのみ、アサーションはテストに書く
async clickLogin(): Promise<void> {
  await this.submitButton.click();
}
// テスト側:
await loginPage.clickLogin();
await expect(page).toHaveURL('/dashboard');
```

---

## 11. クイックリファレンス

```bash
# セットアップ
npm init playwright@latest

# テスト実行
npx playwright test                          # 全テスト
npx playwright test --project=chromium      # 特定ブラウザ
npx playwright test --grep @smoke           # タグフィルタ
npx playwright test --debug                 # Inspector で1ステップずつ実行
npx playwright test --ui                    # UI Mode（タイムトラベルデバッグ）

# レポート
npx playwright show-report                  # HTML レポートを開く（Speedboard/Timeline 含む）

# バージョン管理
npm install -D @playwright/test@latest
npx playwright install                       # ブラウザバイナリも更新
npx playwright --version
```

### 参考リンク
- 公式ドキュメント: https://playwright.dev/docs/intro
- リリースノート: https://playwright.dev/docs/release-notes
- デバイスプリセット一覧: https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/deviceDescriptorsSource.json
