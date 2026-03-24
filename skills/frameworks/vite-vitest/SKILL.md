---
description: Vite ビルド設定 と Vitest テストのベストプラクティス（2026年版）。frontend-implementer / test-implementer / frontend-reviewer が参照する。
---

# Vite + Vitest — ベストプラクティス

> 情報収集日: 2026-03-23 / Vite 8.0 + Vitest 4.x ベース
> Node.js 20.19+ または 22.12+ 必須

## Vite の基本設定

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  resolve: {
    // v8: tsconfigPaths ネイティブサポート（プラグイン不要）
    tsconfigPaths: true,
    alias: {
      '@': './src',  // tsconfig の paths と合わせる
    },
  },

  build: {
    // v8: Rolldown（Rust製）バンドラーで大幅高速化
    // splitVendorChunkPlugin は廃止 → Rolldown が自動最適化
    rollupOptions: {
      output: {
        // 大きなライブラリを手動分割（必要な場合のみ）
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
    sourcemap: false,
  },

  server: {
    port: 3000,
    // バックエンドへのプロキシ（CORSを回避）
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    // ブラウザコンソールをターミナルに転送（v8新機能）
    forwardConsole: true,
  },

  // DevToolsを有効化（v8新機能）
  devtools: true,
});
```

---

## 環境変数

```bash
# .env.local（gitignore必須）
VITE_API_URL=http://localhost:8000

# .env.production
VITE_API_URL=https://api.example.com
```

```typescript
// アクセス方法（VITE_ プレフィックスのみ公開される）
const apiUrl = import.meta.env.VITE_API_URL;

// 型定義（src/vite-env.d.ts）
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## バンドル最適化

```typescript
// Dynamic Import で初期バンドル削減
const HeavyComponent = lazy(() => import('./components/HeavyComponent'));

// v8: splitVendorChunkPlugin は廃止。Rolldown が自動的に最適化する。
// 手動分割は本当に必要な場合だけ（計測してから判断）
rollupOptions: {
  output: {
    manualChunks(id) {
      if (id.includes('node_modules')) {
        if (id.includes('chart.js')) return 'chart';
        if (id.includes('@radix-ui')) return 'radix';
        return 'vendor';
      }
    },
  },
},
```

---

## Vitest 設定

```typescript
// vitest.config.ts（vite.config.tsと統合も可）
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  test: {
    // jsdom環境（DOM APIを使う）
    // ※ コンポーネントテストは Browser Mode も検討（後述）
    environment: 'jsdom',

    // グローバルAPI（describe, it, expect をimportなしで使える）
    globals: true,

    // セットアップファイル
    setupFiles: ['./src/test/setup.ts'],

    // v4: poolOptions は廃止 → トップレベルオプションに
    // ❌ v2/v3: poolOptions: { threads: { singleThread: false } }
    // ✅ v4:
    maxWorkers: 4,   // maxThreads/maxForks の代替

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // v4: all がデフォルト true に（カバレッジ対象が広がる）
      all: true,
      thresholds: {
        functions: 80,
        branches: 80,
        lines: 80,
      },
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.tsx',
      ],
    },
  },

  resolve: {
    tsconfigPaths: true,
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server';

// MSWサーバーの起動・停止
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
```

---

## Browser Mode（v4 stable）

実際のブラウザでコンポーネントテストを実行する。jsdom より信頼性が高い。

```typescript
// vitest.config.ts（Browser Mode設定）
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',  // 'playwright' または 'webdriverio'
      instances: [
        { browser: 'chromium' },
        // { browser: 'firefox' },
        // { browser: 'webkit' },
      ],
    },
    // Browser Mode では environment: 'jsdom' は不要
  },
});
```

```bash
# Playwright プロバイダーのインストール
npm install -D @vitest/browser playwright
npx playwright install chromium
```

---

## テストの書き方（Vitest + Testing Library）

```typescript
// src/features/user/__tests__/UserProfile.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserProfile } from '../UserProfile';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('UserProfile', () => {
  it('should display user information after loading', async () => {
    // Arrange
    render(<UserProfile userId="user-1" />);

    // Assert: ローディング状態
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Assert: データ表示
    await waitFor(() => {
      expect(screen.getByText('テストユーザー')).toBeInTheDocument();
    });
  });

  it('should show error message when fetch fails', async () => {
    // Arrange: エラーレスポンスをモック
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json({ success: false }, { status: 500 });
      })
    );

    // Act
    render(<UserProfile userId="user-1" />);

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('should call onEdit when edit button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<UserProfile userId="user-1" onEdit={onEdit} />);
    await waitFor(() => screen.getByText('テストユーザー'));

    // Act
    await user.click(screen.getByRole('button', { name: '編集' }));

    // Assert
    expect(onEdit).toHaveBeenCalledWith('user-1');
  });
});
```

---

## MSW（Mock Service Worker）設定

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        id: params.id,
        name: 'テストユーザー',
        email: 'test@example.com',
      },
    });
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: { id: 'new-user', ...body },
    }, { status: 201 });
  }),
];

// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

## フレーキーなテストを防ぐ

```typescript
// ✅ タイマーはフェイクタイマーを使う
// v4: performance.now() も自動モック対象になったことに注意
import { vi } from 'vitest';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('should retry after delay', async () => {
  startJob();
  vi.advanceTimersByTime(5000);
  await Promise.resolve();  // マイクロタスクをフラッシュ
  expect(retrySpy).toHaveBeenCalled();
});

// ✅ テキストではなくroleで要素を取得（UIテキスト変更に強い）
screen.getByRole('button', { name: '送信' });  // ✅
screen.getByText('送信');  // △（テキスト変更で壊れる）

// ✅ waitForのタイムアウトをデフォルトのまま使う
await waitFor(() => expect(el).toBeInTheDocument());  // デフォルト1000ms

// ✅ v4: vi.fn() のデフォルト名が変更
// vi.fn().getMockName() === 'vi.fn()'（v3以前は 'spy'）
// スナップショットを使っている場合は更新が必要
```

---

## CIでのシャーディング（大規模プロジェクト）

```yaml
# .github/workflows/test.yml
strategy:
  matrix:
    shardIndex: [1, 2, 3, 4]
    shardTotal: [4]

steps:
  - run: vitest run --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
```

---

## package.json スクリプト

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:browser": "vitest --browser",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## v6/v2 → v8/v4 移行チェックリスト

- [ ] Node.js を 20.19+ または 22.12+ にアップグレード
- [ ] `splitVendorChunkPlugin` の使用箇所を削除
- [ ] `poolOptions` を `maxWorkers` に置き換え
- [ ] `singleThread: true` → `maxWorkers: 1, isolate: false` に変更
- [ ] `vi.fn().getMockName()` のスナップショットを更新（`'spy'` → `'vi.fn()'`）
- [ ] カバレッジが `all: true` になったことでカバレッジ数値が下がっていないか確認
- [ ] `fakeTimers` で `performance.now()` が予期せずモックされていないか確認
