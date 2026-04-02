---
name: typescript
description: TypeScript固有の型設計パターン。frontend-implementer / backend-implementer / frontend-reviewer / backend-reviewer が参照する。
---

# TypeScript 型設計スキル

## 基本原則

- `any` は禁止。使う場合は `// eslint-disable-next-line @typescript-eslint/no-explicit-any` とコメントで理由を明記
- `unknown` を使って型を絞り込む（`any` の代わり）
- `as` キャストは最終手段。型ガードで代替できないか先に検討する

---

## 型設計パターン

### Branded Types（名目的型付け）

IDの取り違えをコンパイル時に防ぐ。

```typescript
// ❌ 構造的型付けの落とし穴
type UserId = string;
type PostId = string;
function getPost(userId: UserId, postId: PostId) { ... }
getPost(postId, userId); // 引数を逆に渡してもエラーにならない

// ✅ Branded Types で防ぐ
type UserId = string & { readonly _brand: 'UserId' };
type PostId = string & { readonly _brand: 'PostId' };

// ファクトリ関数でのみ生成できる
const toUserId = (id: string): UserId => id as UserId;
const toPostId = (id: string): PostId => id as PostId;

getPost(postId, userId); // ✅ コンパイルエラー
```

### Discriminated Union（判別可能ユニオン）

条件分岐を型安全にする。

```typescript
// ❌ フラグで状態を管理（組み合わせが爆発する）
type Result = {
  loading: boolean;
  data?: User;
  error?: Error;
};

// ✅ Discriminated Union で状態を排他的に表現
type Result =
  | { status: 'loading' }
  | { status: 'success'; data: User }
  | { status: 'error'; error: Error };

function render(result: Result) {
  switch (result.status) {
    case 'loading': return <Spinner />;
    case 'success': return <UserCard user={result.data} />; // data は確実に存在
    case 'error': return <ErrorMessage error={result.error} />;
  }
}
```

### `satisfies` 演算子

型チェックをしながら型推論も活かす。

```typescript
// ❌ 型注釈だと推論が失われる
const config: Record<string, string | number> = {
  port: 3000,
  host: "localhost",
};
config.port.toFixed(); // エラー（number か string か判断できない）

// ✅ satisfies で型チェック + 推論を両立
const config = {
  port: 3000,
  host: "localhost",
} satisfies Record<string, string | number>;

config.port.toFixed(); // OK（number と推論される）
```

### 型ガード

`unknown` / ユニオン型を安全に絞り込む。

```typescript
// ユーザー定義型ガード
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "email" in value
  );
}

// エラー型ガード（catch節で使う）
function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

try {
  await riskyOperation();
} catch (error) {
  if (isAppError(error)) {
    // error は AppError として扱える
    console.error(error.code);
  }
}
```

---

## ユーティリティ型の活用

```typescript
// Partial: すべてのプロパティをオプショナルに（更新系で使う）
type UpdateUserInput = Partial<Pick<User, "name" | "email" | "avatarUrl">>;

// Required: すべてのプロパティを必須に
type RequiredConfig = Required<Config>;

// Readonly: 不変オブジェクト
const config: Readonly<Config> = { port: 3000, host: "localhost" };

// ReturnType: 関数の返り値を取得
type UserServiceReturn = ReturnType<typeof userService.findById>;

// Awaited: Promiseの解決型を取得
type ResolvedUser = Awaited<ReturnType<typeof fetchUser>>;

// Pick / Omit: 必要なプロパティだけ抽出・除外
type PublicUser = Omit<User, "passwordHash" | "refreshToken">;
type UserSummary = Pick<User, "id" | "name" | "avatarUrl">;
```

---

## ジェネリクス

```typescript
// 制約付きジェネリクス
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// デフォルト型パラメータ
type ApiResponse<T = unknown> = {
  success: boolean;
  data: T;
};

// 条件型
type NonNullable<T> = T extends null | undefined ? never : T;

// infer で型を抽出
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
```

---

## 定数の型安全な定義

```typescript
// ❌ 文字列リテラルが散らばる
const status = "active"; // どこかで 'Active' と書き間違えても気づけない

// ✅ const assertion で型を絞る
const STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS];
// type Status = 'active' | 'inactive' | 'suspended'
```

---

## よくある間違い

```typescript
// ❌ any を使う
const data: any = JSON.parse(text);

// ✅ unknown で受け取り、型ガードで絞る
const data: unknown = JSON.parse(text);
if (isUser(data)) { ... }

// ❌ ! で null を強制解除
const element = document.getElementById('root')!;

// ✅ null チェックを行う
const element = document.getElementById('root');
if (!element) throw new Error('root element not found');

// ❌ インデックスアクセスの型が undefined になりうる
const first = items[0].name; // items が空だとランタイムエラー

// ✅ オプショナルチェーン
const first = items[0]?.name;
```

---

## TypeScript 6.0（2026年3月リリース）

> TypeScript 6.0 は JavaScript ベースの最後のリリース。TypeScript 7.0 は Go 製ネイティブコンパイラへ移行する。

### 新機能

#### `this` を使わない関数の推論改善

メソッド構文でも `this` を使わない関数はアロー関数と同様に型推論されるようになった。プロパティの定義順に関わらず推論が安定する。

```typescript
declare function callIt<T>(obj: {
  produce: (x: number) => T;
  consume: (y: T) => void;
}): void;

// ✅ TypeScript 6.0 で修正 — 定義順が逆でもエラーにならない
callIt({
  consume(y) {
    return y.toFixed();
  }, // y が正しく number と推論される
  produce(x: number) {
    return x * 2;
  },
});
```

#### サブパスインポート `#/` 対応

`package.json` の `imports` フィールドで `#/` から始まるエイリアスが使えるようになった（Node.js 20+ 対応、`moduleResolution: nodenext` / `bundler` のみ）。

```json
// package.json
{
  "imports": {
    "#/*": "./dist/*"
  }
}
```

```typescript
import * as utils from "#/utils.js"; // ✅ 相対パスを避けられる
```

#### `--moduleResolution bundler` と `--module commonjs` の組み合わせ

これまで `bundler` は `esnext` / `preserve` のみと組み合わせ可能だったが、6.0 から `commonjs` とも組み合わせられる。`--moduleResolution node` 廃止時の移行パスとして活用できる。

#### `es2025` ターゲット / lib 追加

`target: "es2025"` / `lib: ["es2025"]` が追加。`RegExp.escape`・`Promise.try`・`Iterator` メソッド・`Set` メソッドなどの型定義が含まれる。

#### Temporal API の型定義

TC39 Stage 4 に到達した Temporal API の組み込み型が追加。`--target esnext` または `"lib": ["esnext"]`（`esnext.temporal`）で利用可能。

```typescript
const yesterday = Temporal.Now.instant().subtract({ hours: 24 });
const tomorrow = Temporal.Now.instant().add({ hours: 24 });
```

#### `Map.getOrInsert` / `getOrInsertComputed`（ECMAScript upsert）

TC39 Stage 4 のアップサート提案に対応する型が `esnext` lib に追加。

```typescript
// ❌ 従来の冗長なパターン
if (!map.has(key)) map.set(key, defaultValue);
const val = map.get(key)!;

// ✅ getOrInsert
const val = map.getOrInsert(key, defaultValue);

// ✅ getOrInsertComputed — 計算コストが高いデフォルト値に
const val = map.getOrInsertComputed(key, (k) => expensiveCompute(k));
```

#### `RegExp.escape`

TC39 Stage 4 の正規表現エスケープ提案に対応。`es2025` lib で利用可能。

```typescript
const escaped = RegExp.escape(userInput); // *, +, ? などを自動エスケープ
const regex = new RegExp(`\\b${escaped}\\b`, "g");
```

#### `dom` lib に `dom.iterable` / `dom.asynciterable` を統合

`NodeList` や `HTMLCollection` のイテレーションに `dom.iterable` の追加指定が不要になった。

```typescript
// Before: "lib": ["dom", "dom.iterable"] が必要だった
// After:  "lib": ["dom"] のみで OK
for (const el of document.querySelectorAll("div")) { ... }
```

### tsconfig デフォルト値の変更（要注意）

| オプション                     | 旧デフォルト                           | 新デフォルト                      |
| ------------------------------ | -------------------------------------- | --------------------------------- |
| `strict`                       | `false`                                | **`true`**                        |
| `module`                       | `commonjs`                             | **`esnext`**                      |
| `target`                       | `es3`                                  | **`es2025`**（毎年最新に追従）    |
| `rootDir`                      | 入力ファイルの共通ディレクトリ（推論） | **`.`**（tsconfig.json と同階層） |
| `types`                        | `node_modules/@types` 全列挙           | **`[]`**（空配列）                |
| `noUncheckedSideEffectImports` | `false`                                | **`true`**                        |
| `libReplacement`               | `true`                                 | **`false`**                       |

#### `types` の空配列化への対応（最重要）

多くのプロジェクトでビルドエラーが発生する。明示的に記載が必要。

```json
// tsconfig.json
{
  "compilerOptions": {
    "types": ["node"], // Node.js プロジェクト
    "types": ["node", "jest"], // Jest 使用時
    "types": ["*"] // 5.9 以前の挙動に戻す（非推奨）
  }
}
```

#### `rootDir` のデフォルト変更への対応

`src/` 下にソースがある場合は明示的に指定が必要。

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["./src"]
}
```

### 廃止・削除されたオプション

| オプション                                   | 状態     | 移行先                                       |
| -------------------------------------------- | -------- | -------------------------------------------- |
| `target: "es5"`                              | 廃止     | `es2015` 以上を使用                          |
| `--downlevelIteration`                       | 廃止     | ES5 廃止により不要                           |
| `--moduleResolution node` / `node10`         | 廃止     | `nodenext` または `bundler`                  |
| `--moduleResolution classic`                 | **削除** | `nodenext` または `bundler`                  |
| `--module amd` / `umd` / `systemjs` / `none` | **削除** | `esnext` + バンドラー                        |
| `--outFile`                                  | **削除** | Webpack / Rollup / esbuild 等を使用          |
| `--baseUrl`                                  | 廃止     | `paths` に絶対パスで記載                     |
| `esModuleInterop: false`                     | 廃止     | 常に有効化（`import x from "x"` 形式を使用） |
| `allowSyntheticDefaultImports: false`        | 廃止     | 常に有効化                                   |
| `alwaysStrict: false`                        | 廃止     | 全コードが strict mode として扱われる        |

#### `--baseUrl` 廃止への対応

```json
// Before
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": { "@app/*": ["app/*"] }
  }
}

// After — paths に絶対パスで明示
{
  "compilerOptions": {
    "paths": { "@app/*": ["./src/app/*"] }
  }
}
```

#### `module` キーワードによる名前空間宣言がエラーに

```typescript
// ❌ TypeScript 6.0 でエラー
module Foo {
  export const bar = 10;
}

// ✅ namespace キーワードを使う
namespace Foo {
  export const bar = 10;
}

// ✅ アンビエントモジュール宣言は引き続き OK
declare module "some-module" {
  export function doSomething(): void;
}
```

#### import assertions (`asserts`) の廃止

```typescript
// ❌ エラー
import data from "./data.json" asserts { type: "json" };

// ✅ import attributes (with) を使う
import data from "./data.json" with { type: "json" };
```

### TypeScript 7.0 移行準備

- 廃止オプションは `"ignoreDeprecations": "6.0"` で警告を抑制できる（一時的な措置）
- TypeScript 7.0 では廃止オプションが完全に削除される
- 移行支援ツール: [ts5to6](https://github.com/andrewbranch/ts5to6) が `baseUrl` / `rootDir` を自動修正
- `--stableTypeOrdering` フラグを使うと 6.0 の型順序を 7.0 に合わせられる（ビルド最大25%遅くなるため移行確認用途に限定）
- TypeScript 7.0 のプレビュー: `npm install @typescript/native-preview` または VS Code拡張 `TypeScriptTeam.native-preview`
