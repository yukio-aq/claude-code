---
name: zod
description: >
  Zod v4 のベストプラクティス・スキーマ定義・バリデーションパターン。
  frontend-implementer / backend-implementer / frontend-reviewer / backend-reviewer が
  バリデーション・型安全な入力検証を実装・レビューするときに参照する。
---

# Zod v4 — ベストプラクティス

> 情報収集日: 2026-08-05 / Zod v4 ベース
> 公式ドキュメント: https://zod.dev/

---

## 概要

TypeScript-first のスキーマ定義・バリデーションライブラリ。

- 外部依存ゼロ
- コアバンドルサイズ 2kb (gzipped)
- スキーマからTypeScript型を自動推論（`z.infer`）
- `parse` / `safeParse` による安全な入力検証

**典型的なユースケース:**
- APIリクエスト・レスポンスの型検証
- フォームバリデーション（React Hook Form等と組み合わせ）
- 環境変数の検証
- 外部データソース（JSON・APIレスポンス）の安全なパース

---

## インストール・セットアップ

```bash
npm install zod
```

TypeScriptプロジェクトでは `tsconfig.json` で `strict: true` が必須。

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

```typescript
import * as z from "zod";
```

---

## 基本的なスキーマ定義

### プリミティブ型

```typescript
z.string();
z.number();
z.boolean();
z.bigint();
z.null();
z.undefined();
z.symbol();

// リテラル型
z.literal("admin");
z.literal(42);
z.literal(true);
```

### 型強制（Coercion）

文字列から数値など、型を自動変換したい場合に使用する。

```typescript
z.coerce.string();    // String(input)
z.coerce.number();    // Number(input)
z.coerce.boolean();   // Boolean(input)
```

---

## バリデーションオプション

### 文字列

```typescript
z.string().min(5);
z.string().max(100);
z.string().length(10);           // 完全一致
z.email();                       // メールアドレス形式（トップレベル関数）
z.url();                         // URL形式（トップレベル関数）
z.uuid();                        // UUID形式（トップレベル関数）
z.string().regex(/^[a-z]+$/);   // 正規表現
z.string().trim();               // 前後の空白を除去（変換）
z.string().toLowerCase();        // 小文字化（変換）
z.string().toUpperCase();        // 大文字化（変換）
```

> **v4での変更点:** `z.string().email()` / `.url()` / `.uuid()` などのメソッドチェーン形式はレガシー扱い（非推奨）。`z.email()` / `z.url()` / `z.uuid()` のようなトップレベル関数が推奨される（ツリーシェイク性のため）。メソッドチェーン形式もまだ動作するが、次期メジャーバージョンで削除予定のため新規コードでは使わない。

### 数値

```typescript
z.number().min(0);
z.number().max(100);
z.number().int();                // 整数のみ
z.number().positive();           // 0より大きい
z.number().negative();           // 0より小さい
z.number().multipleOf(5);        // 5の倍数
```

### optional / nullable / nullish

```typescript
z.string().optional();     // string | undefined
z.string().nullable();     // string | null
z.string().nullish();      // string | null | undefined

// 関数形式も等価
z.optional(z.string());
z.nullable(z.string());
```

---

## オブジェクトスキーマ

```typescript
const UserSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(["admin", "user", "guest"]),
  age: z.number().optional(),
});

type User = z.infer<typeof UserSchema>;
// => { id: number; name: string; email: string; role: "admin" | "user" | "guest"; age?: number }
```

### 未知キーの扱い

デフォルトでは未知キーはストリップ（削除）される。

```typescript
// 未知キーを許可する（そのまま通す）
z.looseObject({ name: z.string() });

// 未知キーがあるとエラー
z.strictObject({ name: z.string() });

// 未知キーを特定スキーマで検証
z.object({ name: z.string() }).catchall(z.string());
```

---

## 配列・タプル・Enum

### 配列

```typescript
z.array(z.string());
z.array(z.number()).min(1).max(10);
z.array(z.string()).nonempty();  // 1件以上
```

### タプル

```typescript
z.tuple([z.string(), z.number(), z.boolean()]);

// 可変長タプル（残余要素）
z.tuple([z.string()], z.number()); // [string, ...number[]]
```

### Enum

```typescript
const RoleSchema = z.enum(["admin", "user", "guest"]);
type Role = z.infer<typeof RoleSchema>; // "admin" | "user" | "guest"

// 値の取り出し
RoleSchema.options; // ["admin", "user", "guest"]
```

---

## ユニオン・交差

```typescript
// OR型
z.union([z.string(), z.number()]);

// AND型（両スキーマを満たす必要がある）
z.intersection(schemaA, schemaB);

// 判別ユニオン（discriminated union）
const EventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), x: z.number(), y: z.number() }),
  z.object({ type: z.literal("keydown"), key: z.string() }),
]);
```

### `discriminatedUnion` を優先する理由

`z.union` はすべての候補を順に検証するが、`z.discriminatedUnion` は判別子フィールドを見て候補を絞るため高速。

---

## Record / Map / Set

```typescript
z.record(z.string(), z.number());    // Record<string, number>
z.map(z.string(), z.date());         // Map<string, Date>
z.set(z.string());                   // Set<string>
```

---

## parse / safeParse

### parse

バリデーション失敗時に `ZodError` をスローする。

```typescript
try {
  const user = UserSchema.parse(rawInput);
  // user は User 型として推論される
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log(error.issues);
  }
}
```

### safeParse（推奨）

スローせず、成功・失敗を判別可能なオブジェクトを返す。

```typescript
const result = UserSchema.safeParse(rawInput);

if (!result.success) {
  // result.error は ZodError
  console.log(result.error.issues);
  return;
}

// result.data は User 型
console.log(result.data.name);
```

### 非同期バリデーション

`refine` や `transform` に非同期処理を含む場合は `parseAsync` / `safeParseAsync` を使用する。

```typescript
const result = await UserSchema.safeParseAsync(rawInput);
```

---

## TypeScript型推論（z.infer）

```typescript
const ProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  price: z.number().positive(),
  tags: z.array(z.string()),
});

// 出力型を推論（最もよく使う）
type Product = z.infer<typeof ProductSchema>;

// 入力型と出力型が異なる場合（transform使用時）
type ProductInput = z.input<typeof ProductSchema>;
type ProductOutput = z.output<typeof ProductSchema>;
```

スキーマが変われば型も自動的に変わるため、型定義の二重管理が不要になる。

---

## スキーマの合成・変換

### extend / pick / omit / partial / required

```typescript
const BaseSchema = z.object({
  id: z.uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// フィールドを追加
const UserSchema = BaseSchema.extend({
  name: z.string(),
  email: z.email(),
});

// 特定フィールドだけ抽出
const UserSummarySchema = UserSchema.pick({ id: true, name: true });

// 特定フィールドを除外
const UserWithoutTimestamps = UserSchema.omit({ createdAt: true, updatedAt: true });

// 全フィールドをオプション化（PATCH APIに便利）
const UpdateUserSchema = UserSchema.partial();

// 特定フィールドだけオプション化
const PartialUserSchema = UserSchema.partial({ age: true });

// 全フィールドを必須化
const RequiredUserSchema = UserSchema.required();
```

### merge

2つのオブジェクトスキーマを結合する。`extend` と異なり既存スキーマを上書きできる。

```typescript
const merged = SchemaA.merge(SchemaB);
```

### transform

バリデーション後に値を変換する。変換関数内では例外を投げてはならない。

```typescript
const StringToNumberSchema = z.string().transform((val) => parseInt(val, 10));
// z.infer<typeof StringToNumberSchema> => number

const TrimmedEmailSchema = z.email().transform((val) => val.toLowerCase().trim());
```

### pipe

スキーマを連鎖させる。`transform` と組み合わせて使うことが多い。

```typescript
const StringToNumber = z.string().pipe(z.transform((val) => Number(val)));
```

---

## カスタムバリデーション（refine / superRefine）

### refine

単一のカスタム検証ロジックを追加する。

```typescript
const PasswordSchema = z.string().refine(
  (val) => val.length >= 8,
  { error: "パスワードは8文字以上にしてください" }
);

// 非同期バリデーション（DBでの重複チェック等）
const UniqueEmailSchema = z.email().refine(
  async (email) => {
    const exists = await checkEmailExists(email);
    return !exists;
  },
  { error: "このメールアドレスはすでに使用されています" }
);
```

### superRefine

複数のエラーを一度に生成できる。より複雑なバリデーションに使用する。

```typescript
const PasswordConfirmSchema = z.object({
  password: z.string().min(8),
  confirm: z.string(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirm) {
    ctx.addIssue({
      code: "custom",
      message: "パスワードが一致しません",
      path: ["confirm"],
    });
  }
});
```

### refine 使用上の注意

- refine 関数内では例外を投げない（`false` を返してエラーを通知する）
- 非同期 refine を使う場合は `parseAsync` / `safeParseAsync` が必要

---

## デフォルト値・フォールバック

```typescript
// バリデーション成功時のデフォルト値（undefined のとき使われる）
z.string().default("anonymous");
z.number().default(() => Math.random());

// バリデーション失敗時のフォールバック値（エラーを握りつぶす）
z.number().catch(0);
```

---

## エラーハンドリング

### ZodError の構造

`ZodError` は `issues` 配列を持つ。各 issue は以下のプロパティを持つ。

```typescript
// ZodIssue の基本プロパティ
{
  code: string;   // "invalid_type", "too_small", "custom" 等
  path: (string | number)[];  // エラー発生箇所のパス
  message: string;            // 人間が読めるエラーメッセージ
}
```

```typescript
const result = UserSchema.safeParse({ name: 123, email: "not-an-email" });

if (!result.success) {
  result.error.issues;
  // [
  //   { code: "invalid_type", path: ["name"], message: "..." },
  //   { code: "invalid_string", path: ["email"], message: "..." },
  // ]
}
```

### エラーフォーマッティングユーティリティ

#### z.flattenError（フォームバリデーションに最適）

1階層のオブジェクト向けに扁平なエラー形式を返す。

```typescript
const result = UserSchema.safeParse(rawInput);
if (!result.success) {
  const flattened = z.flattenError(result.error);
  // {
  //   formErrors: string[],        // ルートレベルのエラー
  //   fieldErrors: {
  //     email: string[],
  //     name: string[],
  //   }
  // }
}
```

#### z.treeifyError（ネストしたスキーマに最適）

スキーマ構造を反映したツリー形式でエラーを返す。

```typescript
const tree = z.treeifyError(result.error);
tree.properties?.address?.properties?.city?.errors;
tree.properties?.tags?.items?.[0]?.errors;
```

#### z.prettifyError（デバッグ用途）

人間が読める文字列形式でエラーを出力する。

```typescript
console.log(z.prettifyError(result.error));
```

### エラーメッセージのカスタマイズ

```typescript
// スキーマレベルでカスタムメッセージを設定
z.string("文字列を入力してください");
z.string().min(5, { error: "5文字以上で入力してください" });

// パース時に指定
schema.parse(input, { error: (iss) => "入力が無効です" });
```

---

## React/Next.js での典型的な使用パターン

### フォームバリデーション（React Hook Form との組み合わせ）

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const LoginSchema = z.object({
  email: z.email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
});

type LoginFormValues = z.infer<typeof LoginSchema>;

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = (data: LoginFormValues) => {
    // data は LoginFormValues 型として推論される
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <p>{errors.email.message}</p>}
      <input type="password" {...register("password")} />
      {errors.password && <p>{errors.password.message}</p>}
    </form>
  );
}
```

### APIレスポンス検証

```typescript
// schemas/api.ts — スキーマを独立ファイルで管理
const ApiUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.email(),
  createdAt: z.string(), // APIからはstring, 必要なら.transform(val => new Date(val))
});

type ApiUser = z.infer<typeof ApiUserSchema>;

// lib/api.ts
async function fetchUser(id: number): Promise<ApiUser> {
  const res = await fetch(`/api/users/${id}`);
  const json = await res.json();

  const result = ApiUserSchema.safeParse(json);
  if (!result.success) {
    // APIレスポンスが期待と異なる場合を早期検出
    throw new Error(`Invalid API response: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}
```

### Next.js Route Handler でのリクエスト検証

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
  role: z.enum(["admin", "user"]).default("user"),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = CreateUserSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { errors: z.flattenError(result.error).fieldErrors },
      { status: 400 }
    );
  }

  // result.data は型安全
  const user = await createUser(result.data);
  return NextResponse.json(user, { status: 201 });
}
```

### 環境変数の検証

```typescript
// env.ts
const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = EnvSchema.parse(process.env);
// アプリ起動時に環境変数の不備を即検出
```

---

## ベストプラクティス

### スキーマの集約管理

```typescript
// schemas/user.ts — ドメインごとにスキーマをまとめる
export const UserSchema = z.object({ ... });
export const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true });
export const UpdateUserSchema = CreateUserSchema.partial();

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
```

### parse は信頼できない境界でのみ使用する

```typescript
// ✅ 外部入力（APIリクエスト・フォーム・外部API）ではバリデーション必須
const userInput = UserSchema.parse(req.body);

// ❌ 内部で型安全が保証されているデータに parse は不要（オーバーヘッドになる）
const user = UserSchema.parse(knownSafeUser);
```

### 型定義の二重管理を避ける

```typescript
// ❌ 型定義とスキーマを別々に書かない
type User = { name: string; email: string };
const UserSchema = z.object({ name: z.string(), email: z.string() });

// ✅ スキーマから型を派生させる
const UserSchema = z.object({ name: z.string(), email: z.string() });
type User = z.infer<typeof UserSchema>;
```

---

## アンチパターン

### transform 内で例外を投げる

```typescript
// ❌ transform 内の例外は Zod にキャッチされない
const schema = z.string().transform((val) => {
  if (!val) throw new Error("empty"); // NG
  return val;
});

// ✅ refine でバリデーションしてから transform する
const schema = z.string()
  .refine((val) => val.length > 0, { error: "空文字は不可" })
  .transform((val) => val.toUpperCase());
```

### refine 内で例外を投げる

```typescript
// ❌ refine 関数内では例外を投げない
const schema = z.string().refine((val) => {
  if (!val) throw new Error("invalid"); // NG
  return true;
});

// ✅ false を返してエラーを通知する
const schema = z.string().refine((val) => val.length > 0, { error: "空文字は不可" });
```

### safeParse の結果チェックを忘れる

```typescript
// ❌ success チェックなしに data にアクセスするとコンパイルエラー
const result = schema.safeParse(input);
console.log(result.data.name); // result.data が undefined の可能性がある

// ✅ 必ず success をチェックしてから data にアクセスする
const result = schema.safeParse(input);
if (!result.success) return;
console.log(result.data.name); // 型安全
```

### 型アサーションでスキーマを回避する

```typescript
// ❌ バリデーションをスキップして型キャストしない
const user = json as User;

// ✅ スキーマでパースして型安全を保証する
const user = UserSchema.parse(json);
```

---

## レビュー観点（reviewer 向け）

- [ ] 外部入力（リクエストボディ・フォーム・外部API）に `parse` / `safeParse` が適用されているか
- [ ] `safeParse` の後に `result.success` チェックがあるか
- [ ] 型定義がスキーマから `z.infer` で派生しているか（二重管理になっていないか）
- [ ] `transform` / `refine` 内で例外を投げていないか
- [ ] スキーマがドメイン単位でファイルに集約されているか
- [ ] フォームバリデーションに `zodResolver` を使用しているか
- [ ] APIレスポンス検証でエラー時のログ出力にスタックトレースや内部情報を含めていないか
