---
name: observability
description: オブザーバビリティ（OpenTelemetry・LGTM スタック・SLO設計・GenAIトレーシング）のベストプラクティス。observability-engineer / backend-implementer / backend-reviewer が参照する。
when_to_use:
  - ログ・メトリクス・トレースを実装・整備するとき
  - SLO / SLI を定義・計測するとき
  - OpenTelemetry・Grafana・Prometheusを導入するとき
  - LLMエージェントのトレーシングを設計するとき
not_for:
  - パフォーマンスの計測基準・最適化（performanceを使う）
  - エラーハンドリング設計（error-handlingを使う）
  - 負荷テスト（performance-testingを使う）
last_updated: 2026-03-31
---

# オブザーバビリティ ベストプラクティス

> 情報収集日: 2026-03-31
> 調査日: 2026-03-23 / 対象バージョン: OpenTelemetry SDK v1.55、LGTM スタック 2026年3月時点

---

## 三本柱: Logs / Metrics / Traces

| 柱 | 何を知るか | ツール（OSS） |
|---|---|---|
| **Logs** | 何が起きたか（イベント） | Loki + Winston/Pino |
| **Metrics** | どのくらい起きたか（集計） | Mimir + Prometheus |
| **Traces** | なぜ起きたか（因果関係） | Tempo + OpenTelemetry |

### LGTM スタック（推奨OSS構成）
```
Loki    → ログ集約・クエリ（LogQL）
Grafana → 可視化・アラート・ダッシュボード
Tempo   → 分散トレース（Jaeger UI互換）
Mimir   → 長期メトリクス保存（Prometheus互換）
```

---

## 1. OpenTelemetry セットアップ（Node.js）

### インストール

```bash
npm install @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

### 初期化（アプリ起動前に実行）

```typescript
// src/instrumentation.ts — アプリの一番最初にrequire/import
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: process.env.SERVICE_NAME ?? 'my-service',
    [SEMRESATTRS_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? '0.0.1',
    environment: process.env.NODE_ENV ?? 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  }),
  metricExporter: new OTLPMetricExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/metrics',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-redis': { enabled: true },
      // 不要なものは false に（ノイズ削減）
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown().then(() => process.exit(0));
});
```

```json
// package.json
{
  "scripts": {
    "start": "node --require ./dist/instrumentation.js ./dist/index.js"
  }
}
```

---

## 2. カスタムスパン

```typescript
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service', '1.0.0');

// 基本的なカスタムスパン
async function processOrder(orderId: string): Promise<Order> {
  return tracer.startActiveSpan('order.process', async (span) => {
    try {
      span.setAttributes({
        'order.id': orderId,
        'order.source': 'web',
      });

      const result = await doProcessing(orderId);

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

---

## 3. 構造化ログ（Winston + trace_id インジェクション）

```typescript
// src/logger.ts
import winston from 'winston';
import { trace, context } from '@opentelemetry/api';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),         // 構造化ログ（JSON形式）
  ),
  transports: [
    new winston.transports.Console(),
    // 本番環境では Loki exporter や Fluentd を追加
  ],
});

// ログにtrace_id/span_idを自動注入するラッパー
export const log = {
  info: (message: string, meta?: Record<string, unknown>) => {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    logger.info(message, {
      ...meta,
      trace_id: spanContext?.traceId,
      span_id: spanContext?.spanId,
    });
  },
  error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    logger.error(message, {
      ...meta,
      trace_id: spanContext?.traceId,
      span_id: spanContext?.spanId,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
    });
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    logger.warn(message, { ...meta, trace_id: spanContext?.traceId });
  },
};
```

### ログに必ず含めるフィールド

```typescript
// 構造化ログの標準フィールド
interface LogEntry {
  timestamp: string;       // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  service: string;         // サービス名
  trace_id?: string;       // OpenTelemetry trace ID（ログ-トレース紐付け）
  span_id?: string;
  user_id?: string;        // 個人情報は含めない（user_idのみ）
  request_id?: string;     // リクエストごとのID
  duration_ms?: number;    // 処理時間
  error?: {
    name: string;
    message: string;
    stack?: string;        // 本番環境ではスタックトレース省略も検討
  };
}
```

---

## 4. FastAPI 自動計装（Python）

```python
# main.py
from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor

# TracerProvider の設定
provider = TracerProvider()
provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces"))
)
trace.set_tracer_provider(provider)

app = FastAPI()

# 自動計装（ミドルウェアを自動追加）
FastAPIInstrumentor.instrument_app(app)
SQLAlchemyInstrumentor().instrument()
RedisInstrumentor().instrument()

tracer = trace.get_tracer(__name__)

@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    with tracer.start_as_current_span("order.fetch") as span:
        span.set_attribute("order.id", order_id)
        # ...
```

---

## 5. SLO 設計とバーンレートアラート

### SLI / SLO の定義

```yaml
# SLO定義の例
slos:
  - name: api-availability
    description: APIの可用性
    sli:
      ratio:
        good_events: http_requests_total{status!~"5.."}
        total_events: http_requests_total
    target: 0.999    # 99.9% / 月（エラーバジェット: 43分/月）

  - name: api-latency
    description: APIレスポンスタイム
    sli:
      ratio:
        good_events: http_request_duration_seconds_bucket{le="0.5"}
        total_events: http_request_duration_seconds_count
    target: 0.95     # 95%のリクエストが500ms以内
```

### バーンレートアラート（Prometheus記録ルール）

```yaml
# prometheus-rules.yml
groups:
  - name: slo-burn-rate
    rules:
      # 1時間と5分のバーンレートを記録
      - record: job:slo_error_rate:1h
        expr: |
          1 - (
            sum(rate(http_requests_total{status!~"5.."}[1h]))
            / sum(rate(http_requests_total[1h]))
          )

      - record: job:slo_error_rate:5m
        expr: |
          1 - (
            sum(rate(http_requests_total{status!~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))
          )

      # ダブルウィンドウ アラート（誤検知を減らす）
      - alert: SLOHighBurnRateCritical
        expr: |
          job:slo_error_rate:1h > (14.4 * 0.001)   # 14.4x バーンレート（1時間で2%消費）
          AND
          job:slo_error_rate:5m > (14.4 * 0.001)
        for: 2m
        labels:
          severity: critical
          slo: api-availability
        annotations:
          summary: "SLO Critical burn rate: {{ $value | humanizePercentage }} error rate"
          description: "At this rate, the error budget will be exhausted in 1 hour"
          runbook_url: "https://runbooks.internal/slo-burn-rate"

      - alert: SLOHighBurnRateWarning
        expr: |
          job:slo_error_rate:6h > (6 * 0.001)       # 6x バーンレート（6時間で5%消費）
          AND
          job:slo_error_rate:30m > (6 * 0.001)
        for: 15m
        labels:
          severity: warning
          slo: api-availability
        annotations:
          summary: "SLO Warning burn rate: {{ $value | humanizePercentage }} error rate"
```

### バーンレートの計算式

```
バーンレート = 実際のエラー率 / (1 - SLOターゲット)

例: SLO 99.9%（エラーバジェット 0.1%/月）
  バーンレート 1x  → バジェット切れまで 30日（正常）
  バーンレート 14.4x → バジェット切れまで 2日（CRITICAL）
  バーンレート 6x  → バジェット切れまで 5日（WARNING）
```

---

## 6. GenAI/LLMのトレーシング

OpenTelemetry GenAI Semantic Conventions（2026年標準化済み）

```typescript
// LLM呼び出しのトレーシング
import { trace } from '@opentelemetry/api';
import Anthropic from '@anthropic-ai/sdk';

const tracer = trace.getTracer('ai-service');
const client = new Anthropic();

async function callLLM(userMessage: string): Promise<string> {
  return tracer.startActiveSpan('gen_ai.chat', async (span) => {
    const startTime = Date.now();

    span.setAttributes({
      'gen_ai.system': 'anthropic',
      'gen_ai.request.model': 'claude-sonnet-4-6',
      'gen_ai.request.max_tokens': 1000,
      'gen_ai.operation.name': 'chat',
    });

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: userMessage }],
      });

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const latencyMs = Date.now() - startTime;

      span.setAttributes({
        'gen_ai.usage.input_tokens': inputTokens,
        'gen_ai.usage.output_tokens': outputTokens,
        'gen_ai.response.finish_reasons': [response.stop_reason ?? 'end_turn'],
        // コスト計算（claude-sonnet-4-6: $3/$15 per 1M tokens）
        'gen_ai.cost.usd': (inputTokens * 3 + outputTokens * 15) / 1_000_000,
        'gen_ai.latency.ms': latencyMs,
        // TTFT（Time to First Token）- ストリーミング時に計測
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### LLMメトリクスのダッシュボード項目

```
必須パネル:
- TTFT (p50 / p95 / p99) — Time to First Token
- Total Latency (p50 / p95) — 完了まで
- Token 使用量 (input / output / 合計) — コスト直結
- コスト ($) — 日次/週次トレンド
- エラー率 — rate limit / timeout / API error
- ハルシネーション率 — 評価パイプラインから注入（別途実装）
```

---

## 7. Grafana ダッシュボード設計

### パネル構成（推奨）

```
Row 1: サービス概要
  - Uptime (SLO達成率)
  - エラーバジェット残量 (%)
  - リクエストレート (rpm)
  - エラーレート (%)

Row 2: レイテンシ
  - p50 / p95 / p99 レスポンスタイム（時系列）
  - レイテンシ分布（ヒートマップ）

Row 3: インフラ
  - CPU使用率
  - メモリ使用量
  - DB接続プール使用率
  - キャッシュヒット率

Row 4: ビジネスメトリクス（サービス固有）
  - 注文数 / 決済成功率 など
```

### LogQL クエリ例（Loki）

```logql
# エラーログの集計
sum(rate({service="my-service"} |= "error" [5m])) by (service)

# 特定trace_idのログを追跡
{service="my-service"} | json | trace_id="abc123"

# レイテンシが高いリクエストを抽出
{service="my-service"} | json | duration_ms > 1000
```

---

## 8. アラート設計の原則

| レベル | 基準 | 対応 |
|---|---|---|
| CRITICAL | SLOバーンレート > 14.4x（バジェット切れまで1時間） | 即座にページング、インシデント宣言 |
| WARNING | SLOバーンレート > 6x（バジェット切れまで5日） | 業務時間内に対応、根本原因調査 |
| INFO | エラー率上昇傾向、レイテンシ劣化 | ダッシュボードで監視、翌営業日に確認 |

### アラートのアンチパターン

```
❌ 症状ではなく原因にアラートを設定する（CPU 80% → SLOバーンレートにすべき）
❌ アラートが多すぎてアラート疲れになる（30件/日以上は見直し）
❌ ランブックなしのアラート（対応手順なしは意味がない）
❌ p99で閾値を設定する（外れ値に影響される → p95推奨）
```

---

## 9. クイックリファレンス

```bash
# OpenTelemetry Collector（ローカル開発）
docker run -p 4317:4317 -p 4318:4318 \
  otel/opentelemetry-collector-contrib:latest

# Grafana LGTM スタック（ローカル）
docker compose up -d  # grafana/otel-lgtm イメージ使用

# Node.js の自動計装確認
OTEL_LOG_LEVEL=debug node --require ./instrumentation.js ./app.js

# トレースIDをcurlに付与してデバッグ
curl -H "traceparent: 00-$(openssl rand -hex 16)-$(openssl rand -hex 8)-01" \
  http://localhost:3000/api/orders
```
