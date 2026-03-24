---
description: テストルール。カバレッジ基準・命名規則・フレームワーク設定。テストは後付けではなく実装の一部。
---

# テストルール

## カバレッジ基準

| 対象 | 基準 |
|---|---|
| ビジネスロジック（純粋関数） | 95%以上 |
| APIエンドポイント | 90%以上 |
| UIコンポーネント | 80%以上 |
| ユーティリティ関数 | 95%以上 |
| AIエージェント（ツール定義） | 85%以上 |

カバレッジが基準を下回る場合は `test-implementer` で補完してからコミットする。

## テストピラミッド

```
        E2E（少数）
       Integration
    Unit（多数・高速）
```

- Unit: ビジネスロジック・ユーティリティ・純粋関数
- Integration: APIエンドポイント・DB操作・外部サービス連携
- E2E: クリティカルなユーザーフロー（認証・決済・主要導線）のみ

## テスト命名規則

```
// ✅ 良い例: 何を・どんな条件で・どうなるか
should return 401 when token is expired
renders loading skeleton while fetching data
throws ValidationError when email format is invalid

// ❌ 悪い例
test1 / testAuth / works correctly
```

## テストの書き方

- Arrange / Act / Assert の構造を守る
- 1テストにつき1つのアサーションを基本とする
- テスト間で状態を共有しない（各テストは独立して実行できる）
- モックは最小限に留める（振る舞いをテストする）
- `describe` でドメイン・機能単位にグループ化する

## テストしてはいけないこと

- フレームワークやライブラリ自体の動作
- privateメソッドの実装詳細
- モックの呼び出し回数

## フレームワーク別設定

| 領域 | フレームワーク | モック |
|---|---|---|
| TypeScript | Vitest | vi.mock |
| React/Next.js | Vitest + Testing Library | MSW |
| Python | pytest | pytest-mock |
| iOS | XCTest | — |
| Android | JUnit4 + MockK | MockK |
| E2E | Playwright | — |