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
  host: 'localhost',
};
config.port.toFixed(); // エラー（number か string か判断できない）

// ✅ satisfies で型チェック + 推論を両立
const config = {
  port: 3000,
  host: 'localhost',
} satisfies Record<string, string | number>;

config.port.toFixed(); // OK（number と推論される）
```

### 型ガード

`unknown` / ユニオン型を安全に絞り込む。

```typescript
// ユーザー定義型ガード
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
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
type UpdateUserInput = Partial<Pick<User, 'name' | 'email' | 'avatarUrl'>>;

// Required: すべてのプロパティを必須に
type RequiredConfig = Required<Config>;

// Readonly: 不変オブジェクト
const config: Readonly<Config> = { port: 3000, host: 'localhost' };

// ReturnType: 関数の返り値を取得
type UserServiceReturn = ReturnType<typeof userService.findById>;

// Awaited: Promiseの解決型を取得
type ResolvedUser = Awaited<ReturnType<typeof fetchUser>>;

// Pick / Omit: 必要なプロパティだけ抽出・除外
type PublicUser = Omit<User, 'passwordHash' | 'refreshToken'>;
type UserSummary = Pick<User, 'id' | 'name' | 'avatarUrl'>;
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
const status = 'active'; // どこかで 'Active' と書き間違えても気づけない

// ✅ const assertion で型を絞る
const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

type Status = typeof STATUS[keyof typeof STATUS];
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
