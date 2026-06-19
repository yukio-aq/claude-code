---
name: performance-testing
description: パフォーマンステスト（k6 負荷テスト・Lighthouse CI・Core Web Vitals・LLMパフォーマンス）のベストプラクティス。qa-engineer / test-implementer / observability-engineer が参照する。
when_to_use:
  - 負荷テスト・ストレステストを設計・実装するとき
  - Lighthouse CIをCI/CDに組み込むとき
  - LLMのレイテンシ・スループットを計測するとき
not_for:
  - ユニットテスト・統合テスト（testing-patternsを使う）
  - 実装コードのパフォーマンス最適化（performanceを使う）
  - E2Eテスト（testing-patterns/playwright-e2e.mdを使う）
last_updated: 2026-03-31
---

# パフォーマンステスト ベストプラクティス

> 情報収集日: 2026-03-31
> 調査日: 2026-03-23 / 対象: k6 v0.57.x / Lighthouse CI 0.14.x / 2026年3月時点

---

## パフォーマンステストの種類

| 種類            | 目的                           | k6シナリオ名 |
| --------------- | ------------------------------ | ------------ |
| **Smoke Test**  | 基本動作確認（軽量）           | smoke        |
| **Load Test**   | 通常負荷での性能確認           | load         |
| **Stress Test** | 上限を超えた際の挙動確認       | stress       |
| **Soak Test**   | 長時間稼働での劣化確認         | soak         |
| **Spike Test**  | 急激なトラフィック増加への対応 | spike        |

---

## 1. k6 マルチシナリオ設定

### インストール

```bash
# macOS
brew install k6

# npm経由
npm install -g k6

# Docker（CI推奨）
docker pull grafana/k6
```

### 基本スクリプト構造

```javascript
// tests/performance/api-load-test.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Histogram, Rate } from "k6/metrics";

// カスタムメトリクス
const orderErrors = new Counter("order_errors");
const orderDuration = new Histogram("order_duration", { unit: "ms" });
const checkoutSuccessRate = new Rate("checkout_success_rate");

// マルチシナリオ設定
export const options = {
  scenarios: {
    // Smoke: 動作確認（1VU、30秒）
    smoke: {
      executor: "constant-vus",
      vus: 1,
      duration: "30s",
      tags: { scenario: "smoke" },
    },
    // Load: 通常負荷（段階的に増加）
    load: {
      executor: "ramping-vus",
      stages: [
        { duration: "2m", target: 50 }, // ウォームアップ
        { duration: "5m", target: 100 }, // 定常負荷
        { duration: "2m", target: 0 }, // クールダウン
      ],
      tags: { scenario: "load" },
    },
    // Stress: 限界テスト
    stress: {
      executor: "ramping-vus",
      stages: [
        { duration: "2m", target: 100 },
        { duration: "5m", target: 300 },
        { duration: "2m", target: 500 },
        { duration: "2m", target: 0 },
      ],
      tags: { scenario: "stress" },
    },
    // Soak: 長時間安定性（1時間）
    soak: {
      executor: "constant-vus",
      vus: 50,
      duration: "1h",
      tags: { scenario: "soak" },
    },
  },

  // 合格基準（閾値）
  thresholds: {
    // p95 レスポンスタイム 500ms 以下
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    // エラーレート 1% 以下
    http_req_failed: ["rate<0.01"],
    // カスタムメトリクス
    order_duration: ["p(95)<800"],
    checkout_success_rate: ["rate>0.99"],
  },
};

// テストデータのセットアップ
export function setup() {
  // 必要に応じてAPIでテストデータを生成
  return { baseUrl: __ENV.BASE_URL ?? "http://localhost:3000" };
}

// メインテスト関数
export default function (data) {
  const { baseUrl } = data;

  const startTime = Date.now();

  // APIリクエスト（ヘッダーで環境を識別）
  const res = http.post(
    `${baseUrl}/api/orders`,
    JSON.stringify({
      items: [{ productId: "prod-1", quantity: 1 }],
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${__ENV.TEST_API_TOKEN}`,
      },
    },
  );

  // チェック（合否判定）
  const success = check(res, {
    "status is 201": (r) => r.status === 201,
    "response has order id": (r) => JSON.parse(r.body).data?.id !== undefined,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  checkoutSuccessRate.add(success);
  orderDuration.add(Date.now() - startTime);
  if (!success) orderErrors.add(1);

  sleep(1); // 1秒待機（実際のユーザー行動を模倣）
}

// クリーンアップ
export function teardown(data) {
  // テストデータの削除など
}
```

---

## 2. シナリオ別実行コマンド

```bash
# Smoke テスト（PR毎に実行）
k6 run --env BASE_URL=http://localhost:3000 \
  --scenario smoke tests/performance/api-load-test.js

# Load テスト（ステージング環境）
k6 run --env BASE_URL=https://staging.example.com \
  --env TEST_API_TOKEN=$TOKEN \
  --scenario load tests/performance/api-load-test.js

# 全シナリオ実行
k6 run --env BASE_URL=https://staging.example.com tests/performance/api-load-test.js

# 結果をJSONで保存
k6 run --out json=results.json tests/performance/api-load-test.js

# Grafana k6 Cloud へ結果送信
k6 run --out cloud tests/performance/api-load-test.js
```

---

## 3. Core Web Vitals 2026 基準

INP（Interaction to Next Paint）が FID を完全置換（2024年3月〜）

| 指標                                | 良い    | 要改善      | 不良    | 計測ツール        |
| ----------------------------------- | ------- | ----------- | ------- | ----------------- |
| **LCP** (Largest Contentful Paint)  | ≤ 2.5s  | 2.5〜4s     | > 4s    | Lighthouse / CrUX |
| **INP** (Interaction to Next Paint) | ≤ 200ms | 200〜500ms  | > 500ms | Chrome DevTools   |
| **CLS** (Cumulative Layout Shift)   | ≤ 0.1   | 0.1〜0.25   | > 0.25  | Lighthouse        |
| **TTFB** (Time to First Byte)       | ≤ 800ms | 800ms〜1.8s | > 1.8s  | WebPageTest       |
| **FCP** (First Contentful Paint)    | ≤ 1.8s  | 1.8〜3s     | > 3s    | Lighthouse        |

### INP 改善の重要ポイント（FIDからの変更点）

```
FID: 最初のインタラクションのイベント処理時間のみ計測
INP: ページ全体のすべてのインタラクションのうち最悪値を計測

INP が悪い主な原因:
- 長時間のJavaScriptタスク（50ms超）
- メインスレッドのブロッキング
- 不要なレンダリング
```

---

## 4. Lighthouse CI

### インストールと設定

```bash
npm install -D @litehtml/lighthouse-ci
# または
npm install -D @lhci/cli
```

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3000",
        "http://localhost:3000/products",
        "http://localhost:3000/checkout",
      ],
      numberOfRuns: 3, // 3回計測して中央値を採用
      startServerCommand: "npm run start:ci",
      settings: {
        preset: "desktop", // 'mobile' も別途実行推奨
        throttling: {
          // 本番に近い環境でテスト
          cpuSlowdownMultiplier: 2,
          downloadThroughputKbps: 10240,
          uploadThroughputKbps: 10240,
        },
      },
    },
    assert: {
      assertions: {
        // Core Web Vitals
        "categories:performance": ["error", { minScore: 0.9 }],
        "first-contentful-paint": ["error", { maxNumericValue: 1800 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 200 }],
        // アクセシビリティ
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        // SEO
        "categories:seo": ["warn", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "temporary-public-storage", // またはLHCI Server
    },
  },
};
```

### GitHub Actions 統合

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22.x"
          cache: "npm"

      - run: npm ci
      - run: npm run build
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

---

## 5. パフォーマンスバジェット

```json
// budget.json（Lighthouse CI用）
[
  {
    "path": "/*",
    "resourceSizes": [
      { "resourceType": "script", "budget": 300 },
      { "resourceType": "stylesheet", "budget": 50 },
      { "resourceType": "image", "budget": 200 },
      { "resourceType": "font", "budget": 100 },
      { "resourceType": "total", "budget": 700 }
    ],
    "resourceCounts": [{ "resourceType": "third-party", "budget": 10 }],
    "timings": [
      { "metric": "first-contentful-paint", "budget": 1800 },
      { "metric": "largest-contentful-paint", "budget": 2500 },
      { "metric": "cumulative-layout-shift", "budget": 0.1 }
    ]
  }
]
```

---

## 6. k6 Browser モジュール（Web Vitals 計測）

```javascript
// tests/performance/browser-cwv.js
import { browser } from "k6/browser";
import { check } from "k6";

export const options = {
  scenarios: {
    browser: {
      executor: "constant-vus",
      exec: "browserTest",
      vus: 2,
      duration: "1m",
      options: { browser: { type: "chromium" } },
    },
  },
};

export async function browserTest() {
  const page = await browser.newPage();

  try {
    // Webパフォーマンスの計測
    await page.goto("http://localhost:3000/products");

    // Core Web Vitals を取得
    const cwv = await page.evaluate(() => {
      return new Promise((resolve) => {
        let lcp = 0;
        let cls = 0;

        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          lcp = entries[entries.length - 1].startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });

        setTimeout(() => resolve({ lcp, cls }), 3000);
      });
    });

    check(cwv, {
      "LCP < 2.5s": (c) => c.lcp < 2500,
      "CLS < 0.1": (c) => c.cls < 0.1,
    });
  } finally {
    await page.close();
  }
}
```

---

## 7. LLM パフォーマンステスト

### TTFT（Time to First Token）の計測

```javascript
// tests/performance/llm-performance.js
import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";

const ttft = new Trend("llm_ttft_ms", true); // Time to First Token
const totalLatency = new Trend("llm_total_ms", true); // 完了まで
const tokensPerSec = new Trend("llm_tokens_per_sec");

export const options = {
  scenarios: {
    llm_load: {
      executor: "constant-arrival-rate",
      rate: 10, // 10 RPM（トークン消費コスト考慮）
      duration: "5m",
      preAllocatedVUs: 20,
    },
  },
  thresholds: {
    // TTFT p95 < 2000ms
    llm_ttft_ms: ["p(95)<2000"],
    // 合計レイテンシ p95 < 30s
    llm_total_ms: ["p(95)<30000"],
  },
};

export default function () {
  const startTime = Date.now();

  const res = http.post(
    "http://localhost:3000/api/chat",
    JSON.stringify({ message: "Explain the concept of SLO in 3 sentences." }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${__ENV.API_TOKEN}`,
      },
      tags: { name: "llm-chat" },
    },
  );

  const total = Date.now() - startTime;
  totalLatency.add(total);

  const success = check(res, {
    "status is 200": (r) => r.status === 200,
    "has response content": (r) => {
      const body = JSON.parse(r.body);
      return body.data?.content?.length > 0;
    },
  });

  // トークン/秒を記録（レスポンスヘッダーから取得できる場合）
  const outputTokens = parseInt(res.headers["X-Output-Tokens"] ?? "0");
  if (outputTokens > 0 && total > 0) {
    tokensPerSec.add((outputTokens / total) * 1000);
  }
}
```

### LLM パフォーマンス目標値

| 指標                | 目標値       | 説明                                   |
| ------------------- | ------------ | -------------------------------------- |
| TTFT (p95)          | < 2,000ms    | ユーザーが最初のトークンを受け取るまで |
| Total Latency (p95) | モデルによる | Haiku: 5s / Sonnet: 15s / Opus: 30s    |
| Tokens/sec          | > 50 tok/s   | スループット（ストリーミング時）       |
| Concurrency         | 要件次第     | 同時リクエスト数の上限                 |
| Rate Limit 遵守率   | 100%         | 429エラーが発生しないか                |

---

## 8. パフォーマンステストの進め方

```
1. ベースライン計測
   → 現在の性能を数値化（何も最適化しない状態で計測）

2. 目標値設定
   → SLO / Core Web Vitals 基準を目標として定義

3. Smoke テスト
   → 基本動作の確認（1VU、30秒）

4. Load テスト
   → 通常負荷での性能確認（定常VU数、10分）

5. ボトルネック特定
   → Trace + Profiler で遅い箇所を特定

6. 最適化 + 再計測
   → 計測結果で効果を確認（感覚での最適化禁止）

7. Stress / Soak テスト
   → 限界値・長時間安定性の確認

8. CI統合
   → PR毎にSmokeテスト、週次でLoad/Stressテスト
```

---

## 9. CI統合（GitHub Actions）

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 2 * * 1" # 毎週月曜 2:00 AM

jobs:
  smoke:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run smoke test
        uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/performance/api-load-test.js
          flags: --scenario smoke --env BASE_URL=${{ secrets.STAGING_URL }}

  weekly-load:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run load test
        uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/performance/api-load-test.js
          flags: --scenario load --env BASE_URL=${{ secrets.STAGING_URL }}
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: k6-results
          path: results.json
```

---

## 10. クイックリファレンス

```bash
# k6 インストール確認
k6 version

# Smokeテスト（ローカル）
k6 run --vus 1 --duration 30s tests/performance/api-load-test.js

# 詳細メトリクス出力（InfluxDB/Grafana連携）
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/api-load-test.js

# ブラウザテスト
K6_BROWSER_ENABLED=true k6 run tests/performance/browser-cwv.js

# Lighthouse CI ローカル実行
lhci collect --url=http://localhost:3000
lhci assert
lhci upload

# bundlephobia でライブラリサイズ確認（フロントエンド）
# https://bundlephobia.com/package/<package-name>
```
