---
name: react-hook-form
description: >
  React Hook Form v7 のベストプラクティス・API・バリデーションパターン。
  frontend-implementer / frontend-reviewer が
  フォーム実装・レビューをするときに参照する。
---

# React Hook Form v7 — ベストプラクティス

> 情報収集日: 2026-04-24 / React Hook Form v7.74.0 ベース
> 公式ドキュメント: https://react-hook-form.com/

---

## 概要

パフォーマンス・UX・DXを重視した React フォームライブラリ。

- 外部依存ゼロ
- バンドルサイズ 12.5 kB 以下（CJS圧縮済み）
- React 16.8 以上対応（React 19 含む）
- 非制御コンポーネントをベースとした設計で不要な再レンダリングを最小化
- Zod / Yup など 21 種類のバリデーションスキーマライブラリに対応

**典型的なユースケース:**
- ログイン・サインアップ・プロフィール編集フォーム
- 動的フィールド（タグ追加・アイテム一覧の編集）
- shadcn/ui・Radix UI などサードパーティコンポーネントとの統合

---

## インストール・セットアップ

```bash
# コアライブラリ
npm install react-hook-form

# Zod連携（zodResolver）
npm install @hookform/resolvers zod
```

TypeScript プロジェクトでは `tsconfig.json` で `strict: true` が必須。

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
```

---

## useForm の基本

### シグネチャ

```typescript
const {
  register,
  handleSubmit,
  formState,
  watch,
  setValue,
  getValues,
  reset,
  setError,
  clearErrors,
  trigger,
  control,
} = useForm<TFieldValues, TContext, TTransformedValues>(props?: UseFormProps);
```

### UseFormProps

```typescript
type UseFormProps<TFieldValues, TContext, TTransformedValues> = {
  mode?: "onSubmit" | "onBlur" | "onChange" | "onTouched" | "all"; // デフォルト: "onSubmit"
  reValidateMode?: "onSubmit" | "onBlur" | "onChange";             // デフォルト: "onChange"
  defaultValues?: DefaultValues<TFieldValues> | (() => Promise<TFieldValues>);
  resolver?: Resolver;         // 外部スキーマバリデーション（zodResolver等）
  shouldFocusError?: boolean;  // バリデーション失敗時に最初のエラーにフォーカス
  shouldUnregister?: boolean;  // アンマウント時にフィールドを登録解除
  criteriaMode?: "firstError" | "all"; // エラーを1件だけ返すか全件返すか
  delayError?: number;         // エラー表示を遅延させるミリ秒数
};
```

### register

ネイティブ `<input>` / `<select>` / `<textarea>` を React Hook Form に登録する。

```typescript
<input {...register("email")} />

// バリデーションルール付き
<input
  {...register("email", {
    required: "メールアドレスは必須です",
    pattern: {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: "有効なメールアドレスを入力してください",
    },
  })}
/>
```

**register オプション一覧:**

| オプション | 型 | 説明 |
|---|---|---|
| `required` | `boolean \| string` | 必須チェック。文字列はエラーメッセージ |
| `min` | `number \| { value, message }` | 数値の最小値 |
| `max` | `number \| { value, message }` | 数値の最大値 |
| `minLength` | `number \| { value, message }` | 文字列の最小長 |
| `maxLength` | `number \| { value, message }` | 文字列の最大長 |
| `pattern` | `RegExp \| { value, message }` | 正規表現パターン |
| `validate` | `(value, formValues) => boolean \| string \| Promise<boolean \| string>` | カスタムバリデーション |
| `valueAsNumber` | `boolean` | 値を数値に変換（空文字は `NaN`） |
| `valueAsDate` | `boolean` | 値を Date オブジェクトに変換 |
| `setValueAs` | `(value: any) => any` | カスタム変換関数（`validate` より前に実行） |
| `shouldUnregister` | `boolean` | アンマウント時に値と参照を削除 |
| `disabled` | `boolean` | フィールドを無効化 |
| `deps` | `string \| string[]` | 依存フィールドの再バリデーションをトリガー |

### handleSubmit

バリデーション通過後に `onValid` を、失敗時に `onInvalid` を呼び出す。

```typescript
type UseFormHandleSubmit<TFieldValues, TTransformedValues> = (
  onValid: SubmitHandler<TTransformedValues>,
  onInvalid?: SubmitErrorHandler<TFieldValues>
) => (e?: React.BaseSyntheticEvent) => Promise<void>;
```

```typescript
const onSubmit = handleSubmit(
  async (data) => {
    // data は TFieldValues 型として推論される
    await createUser(data);
  },
  (errors) => {
    // バリデーション失敗時
    console.log(errors);
  }
);

<form onSubmit={onSubmit}>...</form>
```

### formState

```typescript
type FormState<TFieldValues> = {
  isDirty: boolean;             // デフォルト値から変更があるか
  isSubmitted: boolean;         // 一度以上送信されたか
  isSubmitting: boolean;        // 送信処理中か
  isSubmitSuccessful: boolean;  // 最後の送信が成功したか
  isValidating: boolean;        // バリデーション中か（非同期バリデーション等）
  isValid: boolean;             // フォーム全体がエラーなしか
  isLoading: boolean;           // defaultValues が非同期取得中か
  submitCount: number;          // 送信試行回数
  dirtyFields: FieldNamesMarkedBoolean<TFieldValues>; // 変更済みフィールド
  touchedFields: FieldNamesMarkedBoolean<TFieldValues>; // タッチ済みフィールド
  errors: FieldErrors<TFieldValues>; // エラーオブジェクト
};
```

> **注意:** `formState` はプロキシ経由でアクセスされるため、使用するプロパティを分割代入しておくこと。未使用のプロパティを参照しない設計で不要な再レンダリングを回避している。

```typescript
// ✅ 使用するプロパティを明示的に取得する
const { errors, isSubmitting } = formState;

// ❌ formState 全体を渡すと全プロパティを購読してしまう
```

---

## バリデーション

### 組み込みバリデーション

```typescript
const LoginSchema = {
  email: {
    required: "メールアドレスは必須です",
    pattern: {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: "メールアドレスの形式が正しくありません",
    },
  },
  password: {
    required: "パスワードは必須です",
    minLength: {
      value: 8,
      message: "パスワードは8文字以上にしてください",
    },
  },
};
```

### Zod との連携（zodResolver）

Zod スキーマを `resolver` に渡すことで、スキーマベースのバリデーションを実現する。

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
});

// スキーマから型を推論（二重管理を避ける）
type LoginFormValues = z.infer<typeof LoginSchema>;

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
  });

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <input {...register("email")} />
      {errors.email && <p>{errors.email.message}</p>}

      <input type="password" {...register("password")} />
      {errors.password && <p>{errors.password.message}</p>}

      <button type="submit">ログイン</button>
    </form>
  );
}
```

### input/output 型が異なる場合

`transform` を使う Zod スキーマでは入力型と出力型が異なる。`z.input` / `z.output` で明示的に指定する。

```typescript
const Schema = z.object({
  age: z.string().transform((val) => parseInt(val, 10)),
});

type SchemaInput = z.input<typeof Schema>;   // { age: string }
type SchemaOutput = z.output<typeof Schema>; // { age: number }

// useForm の型パラメータ: <入力型, Context型, 出力型>
const { register, handleSubmit } = useForm<SchemaInput, unknown, SchemaOutput>({
  resolver: zodResolver(Schema),
});
```

### カスタムバリデーション（validate）

```typescript
// 単一バリデーション
register("username", {
  validate: (value) => value !== "admin" || "この名前は使用できません",
});

// 複数バリデーション（criteriaMode: "all" と組み合わせる）
register("password", {
  validate: {
    hasUppercase: (v) => /[A-Z]/.test(v) || "大文字を含めてください",
    hasNumber: (v) => /[0-9]/.test(v) || "数字を含めてください",
  },
});

// フォーム全体の値を参照するバリデーション
register("confirmPassword", {
  validate: (value, formValues) =>
    value === formValues.password || "パスワードが一致しません",
});
```

---

## Controller / useController

ネイティブ HTML 要素でない（`ref` を `<input>` に渡せない）コンポーネントと連携するために使用する。
shadcn/ui・Radix UI・MUI などのカスタムコンポーネントに適用する。

### Controller（JSX ラッパー）

```typescript
import { Controller } from "react-hook-form";

<Controller
  name="category"
  control={control}
  render={({ field, fieldState, formState }) => (
    <Select
      value={field.value}
      onValueChange={field.onChange}
      disabled={field.disabled}
    >
      {/* ... */}
    </Select>
  )}
/>
```

**ControllerRenderProps（`field` プロパティ）:**

| プロパティ | 説明 |
|---|---|
| `value` | 現在のフィールド値 |
| `onChange` | 値変更ハンドラ |
| `onBlur` | フォーカス離脱ハンドラ |
| `name` | フィールド名 |
| `ref` | フォームへの参照（フォーカス制御に使用） |
| `disabled` | 無効化状態 |

**ControllerFieldState（`fieldState` プロパティ）:**

| プロパティ | 説明 |
|---|---|
| `invalid` | エラーがあるか |
| `isTouched` | タッチされたか |
| `isDirty` | 変更されたか |
| `isValidating` | バリデーション中か |
| `error` | エラーオブジェクト |

### useController（カスタムコンポーネントの内部で使用）

```typescript
import { useController, UseControllerProps } from "react-hook-form";

type CustomInputProps<T extends FieldValues> = UseControllerProps<T> & {
  label: string;
};

function CustomInput<T extends FieldValues>({
  name,
  control,
  rules,
  label,
}: CustomInputProps<T>) {
  const {
    field,
    fieldState: { error },
  } = useController({ name, control, rules });

  return (
    <div>
      <label>{label}</label>
      <input {...field} />
      {error && <p>{error.message}</p>}
    </div>
  );
}
```

### shadcn/ui との連携例

```typescript
import { Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";

<Controller
  name="agreeToTerms"
  control={control}
  render={({ field }) => (
    <Checkbox
      checked={field.value}
      onCheckedChange={field.onChange}
    />
  )}
/>
```

---

## useFieldArray（動的フィールド）

配列形式のフィールドを管理する。

### 基本的な使い方

```typescript
import { useForm, useFieldArray } from "react-hook-form";

type FormValues = {
  items: { name: string; quantity: number }[];
};

function DynamicForm() {
  const { control, register, handleSubmit } = useForm<FormValues>({
    defaultValues: { items: [{ name: "", quantity: 1 }] },
  });

  const { fields, append, prepend, remove, insert, swap, move, update, replace } =
    useFieldArray({
      control,
      name: "items",
    });

  return (
    <form onSubmit={handleSubmit(console.log)}>
      {fields.map((field, index) => (
        <div key={field.id}>
          {/* field.id を key に使うこと（index は不可） */}
          <input {...register(`items.${index}.name`)} />
          <input
            type="number"
            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
          />
          <button type="button" onClick={() => remove(index)}>
            削除
          </button>
        </div>
      ))}
      <button type="button" onClick={() => append({ name: "", quantity: 1 })}>
        追加
      </button>
    </form>
  );
}
```

### UseFieldArrayProps

```typescript
type UseFieldArrayProps = {
  name: string;           // 配列フィールドのパス
  control: Control;       // useForm の control
  keyName?: string;       // デフォルト: "id"（fields の一意キーに使用）
  rules?: {
    required?: boolean | string;
    minLength?: number;
    maxLength?: number;
    validate?: ValidateFunction;
  };
  shouldUnregister?: boolean;
};
```

### メソッド一覧

| メソッド | シグネチャ | 説明 |
|---|---|---|
| `append` | `(value, options?) => void` | 末尾に追加 |
| `prepend` | `(value, options?) => void` | 先頭に追加 |
| `insert` | `(index, value, options?) => void` | 指定位置に挿入 |
| `remove` | `(index?) => void` | 指定位置を削除（省略で全削除） |
| `swap` | `(indexA, indexB) => void` | 2つの要素を入れ替え |
| `move` | `(from, to) => void` | 要素を移動 |
| `update` | `(index, value) => void` | 指定位置を更新 |
| `replace` | `(value[]) => void` | 配列全体を置換 |

### ネストされた配列

```typescript
// ネストされた useFieldArray
const { fields: nestedFields, append: appendNested } = useFieldArray({
  control,
  name: `parentItems.${parentIndex}.children`,
});
```

---

## watch / setValue / getValues / reset

### watch

フィールド値の変化をリアルタイムで購読する。購読するとコンポーネントが再レンダリングされる。

```typescript
// 全フィールドを監視
const allValues = watch();

// 単一フィールドを監視
const email = watch("email");

// 複数フィールドを監視
const [firstName, lastName] = watch(["firstName", "lastName"]);

// コールバックで購読（パフォーマンス最適化）
// useEffect 内で使用し、unmount 時に unsubscribe する
useEffect(() => {
  const subscription = watch((value, { name, type }) => {
    console.log(value, name, type);
  });
  return () => subscription.unsubscribe();
}, [watch]);
```

> **注意:** `watch()` は毎回新しいオブジェクトを返すため、`useEffect` の依存配列に入れると無限ループになる。コールバック形式の `watch` を使うこと。

### setValue

プログラム的にフィールド値を設定する。

```typescript
type SetValueConfig = {
  shouldValidate?: boolean; // バリデーションを実行するか
  shouldDirty?: boolean;    // isDirty を更新するか
  shouldTouch?: boolean;    // isTouched を更新するか
};

setValue("email", "user@example.com");
setValue("email", "user@example.com", { shouldValidate: true, shouldDirty: true });

// ネストされたフィールド
setValue("address.city", "Tokyo");

// 配列フィールド
setValue("items.0.name", "Item 1");
```

### getValues

現在のフォーム値をリアクティブでなく取得する（再レンダリングを引き起こさない）。

```typescript
// 全フィールドの値を取得
const allValues = getValues();

// 単一フィールドの値を取得
const email = getValues("email");

// 複数フィールドの値を取得（タプルで返る）
const [firstName, lastName] = getValues(["firstName", "lastName"]);
```

> `watch` との違い: `getValues` は「スナップショット取得」で再レンダリングを発生させない。イベントハンドラ内での取得に使用する。

### reset

フォームの状態をリセットする。

```typescript
type KeepStateOptions = {
  keepDirtyValues?: boolean;      // 変更済みフィールドの値を保持
  keepErrors?: boolean;           // エラーを保持
  keepDirty?: boolean;            // isDirty 状態を保持
  keepValues?: boolean;           // フィールド値を保持
  keepDefaultValues?: boolean;    // defaultValues を保持
  keepIsSubmitted?: boolean;      // isSubmitted を保持
  keepIsSubmitSuccessful?: boolean;
  keepTouched?: boolean;
  keepIsValidating?: boolean;
  keepIsValid?: boolean;
  keepSubmitCount?: boolean;
};

// 完全リセット（デフォルト値に戻す）
reset();

// 新しい値でリセット
reset({ email: "new@example.com", password: "" });

// 状態の一部を保持しつつリセット
reset(undefined, { keepDirtyValues: true });
```

---

## エラーハンドリング・エラー表示パターン

### setError / clearErrors

```typescript
// フィールドエラーを手動で設定（サーバーサイドエラー等）
setError("email", {
  type: "server",
  message: "このメールアドレスは既に使用されています",
});

// ネストされたフィールド
setError("address.city", { type: "manual", message: "市区町村を入力してください" });

// ルートレベルのエラー（フォーム全体のエラー）
setError("root.serverError", {
  type: "500",
  message: "サーバーエラーが発生しました",
});

// エラーをクリア
clearErrors("email");
clearErrors(["email", "password"]);
clearErrors(); // 全エラーをクリア
```

### フォーム送信時のサーバーエラー処理

```typescript
const onSubmit = handleSubmit(async (data) => {
  try {
    await loginApi(data);
  } catch (error) {
    setError("root.serverError", {
      type: "manual",
      message: "メールアドレスまたはパスワードが正しくありません",
    });
  }
});

// テンプレート側
{errors.root?.serverError && (
  <p role="alert">{errors.root.serverError.message}</p>
)}
```

### エラー表示パターン

```typescript
// 単一エラーメッセージ
{errors.email && <p role="alert">{errors.email.message}</p>}

// オプショナルチェーンを使った安全なアクセス
{errors.email?.message && <p role="alert">{errors.email.message}</p>}

// ネストされたフィールドのエラー
{errors.address?.city && <p>{errors.address.city.message}</p>}

// 配列フィールドのエラー
{errors.items?.[index]?.name && (
  <p>{errors.items[index].name.message}</p>
)}

// 複数エラータイプ（criteriaMode: "all" の場合）
{errors.password?.types && (
  <ul>
    {Object.entries(errors.password.types).map(([type, msg]) => (
      <li key={type}>{msg as string}</li>
    ))}
  </ul>
)}
```

### trigger（手動バリデーション）

```typescript
// 単一フィールドをバリデーション
await trigger("email");

// 複数フィールドをバリデーション
await trigger(["email", "password"]);

// フォーム全体をバリデーション
const isValid = await trigger();
```

---

## フォーム送信・非同期バリデーション

### 非同期バリデーション

```typescript
register("username", {
  validate: async (value) => {
    const exists = await checkUsernameExists(value);
    return !exists || "このユーザー名は既に使用されています";
  },
});

// 非同期バリデーション中は formState.isValidating が true になる
{formState.isValidating && <span>確認中...</span>}
```

### 送信中の状態管理

```typescript
function SubmitButton() {
  const { formState: { isSubmitting } } = useFormContext();

  return (
    <button type="submit" disabled={isSubmitting}>
      {isSubmitting ? "送信中..." : "送信"}
    </button>
  );
}
```

### 非同期 defaultValues

サーバーからデータを取得してフォームを初期化する。

```typescript
const { register } = useForm<UserFormValues>({
  defaultValues: async () => {
    const user = await fetchUser(userId);
    return { name: user.name, email: user.email };
  },
});

// defaultValues 取得中は formState.isLoading が true になる
```

---

## TypeScript での型定義パターン

### 基本パターン

```typescript
import { useForm, SubmitHandler, SubmitErrorHandler } from "react-hook-form";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// スキーマから型を派生（二重管理を避ける）
type FormValues = z.infer<typeof Schema>;

// SubmitHandler で型付け
const onSubmit: SubmitHandler<FormValues> = (data) => {
  // data は FormValues 型
};

const onError: SubmitErrorHandler<FormValues> = (errors) => {
  // errors は FieldErrors<FormValues> 型
};
```

### カスタムコンポーネントの型付け

```typescript
import {
  UseControllerProps,
  FieldValues,
  FieldPath,
} from "react-hook-form";

type FormInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = UseControllerProps<TFieldValues, TName> & {
  label: string;
  placeholder?: string;
};

function FormInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ label, placeholder, ...controllerProps }: FormInputProps<TFieldValues, TName>) {
  const { field, fieldState } = useController(controllerProps);

  return (
    <div>
      <label>{label}</label>
      <input {...field} placeholder={placeholder} />
      {fieldState.error && <p>{fieldState.error.message}</p>}
    </div>
  );
}
```

### FormProvider でコンテキストを共有する

```typescript
import { useForm, FormProvider, useFormContext } from "react-hook-form";

// 親コンポーネント
function ParentForm() {
  const methods = useForm<FormValues>();

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <ChildInput />
      </form>
    </FormProvider>
  );
}

// 子コンポーネント（control を props で受け渡さなくてよい）
function ChildInput() {
  const { register, formState: { errors } } = useFormContext<FormValues>();

  return (
    <>
      <input {...register("email")} />
      {errors.email && <p>{errors.email.message}</p>}
    </>
  );
}
```

---

## ベストプラクティス

### mode の選択

```typescript
// onSubmit（デフォルト）: 送信ボタンを押してからバリデーション → UX が良い
useForm({ mode: "onSubmit" });

// onBlur: フォーカスが外れたときにバリデーション
useForm({ mode: "onBlur" });

// onChange: 入力のたびにバリデーション → 多用するとパフォーマンス低下の可能性あり
useForm({ mode: "onChange" });

// all: onBlur + onChange の両方でバリデーション
useForm({ mode: "all" });
```

### defaultValues を必ず設定する

```typescript
// ✅ 初期値を設定することで isDirty の比較基準が確立される
useForm<FormValues>({
  defaultValues: { name: "", email: "" },
});

// ❌ 未設定の場合、初回レンダリング時に uncontrolled → controlled の警告が発生することがある
useForm<FormValues>();
```

### フィールドキーに index ではなく field.id を使う

```typescript
// ✅ useFieldArray が生成した一意 ID を使う
{fields.map((field, index) => (
  <div key={field.id}>...</div>
))}

// ❌ index をキーにすると削除・並び替え時に予期しない挙動になる
{fields.map((field, index) => (
  <div key={index}>...</div>
))}
```

### getValues と watch の使い分け

```typescript
// ✅ イベントハンドラ内での値取得 → getValues（再レンダリングなし）
const handleCalculate = () => {
  const { price, quantity } = getValues();
  setTotal(price * quantity);
};

// ✅ 値の変化に応じた UI 更新 → watch（リアクティブ）
const email = watch("email");
```

### resolver と組み込みバリデーションを混在させない

```typescript
// ❌ resolver と register バリデーションを両方使うと干渉する
useForm({ resolver: zodResolver(Schema) });
register("email", { required: true }); // resolver 使用時はこちらは無視される

// ✅ resolver を使う場合はすべてのバリデーションをスキーマに集約する
const Schema = z.object({
  email: z.string().min(1).email(),
});
useForm({ resolver: zodResolver(Schema) });
register("email"); // バリデーションルールはスキーマ側に書く
```

---

## アンチパターン

### useEffect で watch の戻り値を依存配列に入れる

```typescript
// ❌ watch() は毎回新しいオブジェクトを返すため無限ループになる
useEffect(() => {
  console.log(watch());
}, [watch()]);

// ✅ コールバック形式を使う
useEffect(() => {
  const subscription = watch((value) => console.log(value));
  return () => subscription.unsubscribe();
}, [watch]);
```

### handleSubmit をネストする

```typescript
// ❌ handleSubmit の中で handleSubmit を呼ばない
<form onSubmit={handleSubmit(() => handleSubmit(onSubmit)())}>

// ✅ 単一の onSubmit ハンドラに処理をまとめる
<form onSubmit={handleSubmit(onSubmit)}>
```

### Controller と register を同一フィールドに混在させる

```typescript
// ❌ 同じフィールドに Controller と register を両方使わない
<Controller name="email" control={control} render={...} />
<input {...register("email")} />

// ✅ どちらか一方を選ぶ
// ネイティブ要素 → register
// カスタムコンポーネント → Controller / useController
```

### useFieldArray で fields を直接変更する

```typescript
// ❌ fields 配列を直接変更しない（React Hook Form の状態が壊れる）
fields.push({ name: "" });

// ✅ append メソッドを使う
append({ name: "" });
```

### 型アサーションでエラーを握りつぶす

```typescript
// ❌ errors の型アサーションは避ける
const error = errors.email as FieldError;

// ✅ オプショナルチェーンで安全にアクセスする
const errorMessage = errors.email?.message;
```

---

## レビュー観点（reviewer 向け）

- [ ] `defaultValues` が設定されているか（未設定は uncontrolled 警告・`isDirty` の誤動作につながる）
- [ ] `formState` から使用するプロパティを分割代入しているか（プロキシの最適化を活かすため）
- [ ] `useFieldArray` の `key` に `field.id` を使っているか（`index` は使わない）
- [ ] `watch` をコールバック形式で使い、`unsubscribe` しているか
- [ ] `resolver` と `register` のバリデーションを混在させていないか
- [ ] ネイティブ要素には `register`、カスタムコンポーネントには `Controller` / `useController` を使っているか
- [ ] サーバーエラーを `setError("root.xxx", ...)` でセットしているか（フィールドエラーと分離）
- [ ] `handleSubmit` の中で `await` が必要な処理を正しく待っているか
- [ ] `z.infer` でスキーマから型を派生させており、型の二重管理になっていないか
