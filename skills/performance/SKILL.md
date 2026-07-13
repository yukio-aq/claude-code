---
name: performance
description: フロントエンド・バックエンド・AIエージェント・3D・モバイルのパフォーマンス計測基準と最適化手法。frontend-implementer / backend-implementer / frontend-reviewer / backend-reviewer が参照する。
when_to_use:
  - パフォーマンスのボトルネックを特定・最適化するとき
  - バンドルサイズ削減・レンダリング最適化を行うとき
  - Core Web Vitalsのスコアを改善するとき
  - クエリ・API レスポンスタイムを改善するとき
keywords:
  - パフォーマンス
  - 最適化
  - 速度改善
  - チューニング
links:
  related: [performance-testing, database]
not_for:
  - 負荷テスト・ベンチマーク設計（performance-testingを使う）
  - SLO・監視ダッシュボードの構築（observabilityを使う）
last_updated: 2026-04-17
---

# パフォーマンスルール

> 情報収集日: 2026-04-17
> **最適化は計測してから。計測なしの早期最適化はしない。**

## 計測基準

| 指標 | 基準値 | 計測ツール |
|---|---|---|
| LCP | 2.5秒以下 | Lighthouse |
| INP | 100ms以下 | Chrome DevTools |
| CLS | 0.1以下 | Lighthouse |
| APIレスポンスタイム | p95で500ms以下 | サーバーログ |
| 3D / Unity | 60fps維持 | Stats.js / Unity Profiler |

## フロントエンド

- `useCallback` / `useMemo` は計測後に適用（闇雲に使わない）
- 大きなリストは仮想化（`react-window` / `@tanstack/virtual`）
- Dynamic Importで初期バンドルを削減
- ライブラリ追加時は bundlephobia.com でサイズを確認
- 画像は `next/image` を使う

## バックエンド

- クエリの実行計画を `EXPLAIN ANALYZE` で確認する
- インデックスは外部キー・WHERE句・ORDER BYのカラムに作成する
- N+1クエリは発見したら即修正
- 読み取り頻度高・更新頻度低なデータは Redis でキャッシュ
- 重い処理はジョブキューに逃がす

## AIエージェント（Mastra / LangChain）

- LLM呼び出しは最小限に（不要な呼び出しをパイプラインから削除）
- モデルは「タスクに必要な最小サイズ」を選ぶ（Opus → Sonnet → Haiku）
- ストリーミングレスポンスを使ってUXを改善する
- プロンプトの長さを監視する（長すぎるコンテキストはコストに直結）
- キャッシュ可能なLLM呼び出しは積極的にキャッシュする

## 3D（Three.js / R3F）

- ジオメトリ・マテリアルは必ず `dispose()` する
- テクスチャは `TextureLoader` で共有する
- `useFrame` 内では新しいオブジェクト生成をしない
- ドローコールは100以下を目安に

## Unity

- `Update()` 内でのメモリアロケーションを避ける
- Profilerで `GC.Alloc` を定期確認する
- Static Batching / GPU Instancing でDrawCallを削減
- テクスチャはAtlasにまとめる

## iOS / Android

- メインスレッドをブロックしない（重い処理は非同期に）
- 画像は端末の解像度に合わせてダウンサンプリング
- バックグラウンド時のリソース解放を実装する
