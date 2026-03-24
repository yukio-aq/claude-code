---
description: Tavilyを使ったリアルタイム情報収集のガイドライン。architect / ai-agent-designer / ai-agent-implementer / qa-engineer が参照する。
---

# ドキュメント検索パターン（Tavily）

## 必ずTavilyで検索するタイミング

### 技術選定時（architect）

```
検索すること:
- 各選択肢の最新バージョン・メンテナンス状況
- 既知の問題・Breaking Changes
- 本番利用事例・パフォーマンス比較

検索クエリの例:
"Hono vs Express 2026 performance"
"Mastra vs LangChain production 2026"
"pgvector vs Qdrant comparison 2026"
```

### 実装時（ai-agent-implementer）

```
検索すること:
- 使用ライブラリの最新API・バージョン
- 公式ドキュメントのサンプルコード
- 既知のバグ・workaround

検索クエリの例:
"Mastra agent tools API 2026"
"Hono middleware authentication example"
"React 19 breaking changes"
```

### セキュリティレビュー時（ai-agent-reviewer / backend-reviewer）

```
検索すること:
- 使用ライブラリのCVE・脆弱性情報
- OWASP最新ガイドライン

検索クエリの例:
"CVE [ライブラリ名] 2026"
"OWASP LLM top 10 2025"
```

### テスト設計時（qa-engineer）

```
検索すること:
- フレームワーク固有のテストベストプラクティス
- テストツールの最新API

検索クエリの例:
"Vitest React Testing Library best practices 2026"
"Mastra agent testing patterns"
```

---

## 検索結果の使い方

### 信頼度の判定

```
高信頼: 公式ドキュメント・GitHub公式リポジトリ
中信頼: Vercel・Cloudflare・Anthropic等の公式ブログ
低信頼: 個人ブログ・古いStack Overflow（1年以上前）
```

### llms.txt の活用

多くのドキュメントサイトは `/llms.txt` でLLM向けのドキュメントを提供している。

```
https://mastra.ai/llms.txt
https://hono.dev/llms.txt
https://docs.anthropic.com/llms.txt
```

---

## 検索しなくていいタイミング

- JavaScript / TypeScript の基本文法
- React の基本的なフック（useState / useEffect 等）
- Git の基本操作
- SQL の基本構文
- skills/coding-standards/ に記載済みのパターン
