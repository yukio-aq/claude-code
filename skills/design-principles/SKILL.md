---
name: design-principles
description: ソフトウェア設計思想のカタログ（Tidy First・DRY・YAGNI・KISS・SOLID・Boy Scout Rule・Law of Demeter・Composition over Inheritance・CQS・Fail Fast）。architect / refactor-planner / refactor-implementer / backend-implementer / frontend-implementer / backend-reviewer / frontend-reviewer が参照する。
when_to_use:
  - 設計判断のトレードオフを検討するとき
  - リファクタリングの方針・順序を決めるとき
  - コードレビューで抽象化・重複除去の妥当性を判断するとき
  - 「このコードは複雑すぎないか」を判断するとき
keywords:
  - Tidy First
  - DRY
  - YAGNI
  - KISS
  - SOLID
  - Boy Scout Rule
  - Law of Demeter
  - リファクタリング
  - 設計原則
links:
  related: [architecture, error-handling]
not_for:
  - 具体的なアーキテクチャパターン（レイヤー構成・依存方向は architecture を使う）
  - 言語固有の型設計（typescript を使う）
last_updated: 2026-08-06
---

# 設計原則カタログ

> 情報収集日: 2026-08-06

このスキルは「いつ適用すべきか」の判断を伴う思想集。ルールのように機械的に
全部当てはめるのではなく、状況に応じて必要なものだけを選んで適用する。
すべてに共通する問い: **「この判断は今のコードを楽にしているか、それとも
将来のための投機的な仕組みを増やしているか」**。前者なら適用する価値が高い。

---

## Tidy First — 構造変更と振る舞い変更を分離する

**原則:** 構造変更（tidying: リネーム・関数抽出・ガード節化など意味を変えない整理）
と振る舞い変更（feature/fix: 挙動が変わる変更）を同じコミットに混ぜない。
振る舞い変更が難しいときは、先に小さな構造変更をしてから本題に着手する。

**経済的判断:** tidyingは投資。「将来のコスト削減 > 今かける時間」の場合のみ
行う。割に合わないなら無理にtidyingしない（過剰な先回りリファクタを防ぐ）。

```typescript
// 悪い例: リネーム（構造変更）とバグ修正（振る舞い変更）が同じコミット
// commit: "fix: correct discount calculation"
- function calcDiscnt(price, rate) {
-   return price * rate;  // バグ: 割引後価格を返すべき
+ function calculateDiscount(price: number, rate: number): number {
+   return price - (price * rate);
  }
// → レビュアーはリネームとロジック変更のどちらが原因か切り分けられない

// 良い例: 2コミットに分割
// commit 1: "refactor: rename calcDiscnt to calculateDiscount"（構造のみ）
// commit 2: "fix: return discounted price instead of discount amount"（振る舞いのみ）
```

---

## DRY (Don't Repeat Yourself)

**原則:** 同じ「知識」を複数箇所に重複させない。ここでの重複は**コードの見た目**
ではなく**ビジネスルールの重複**を指す。見た目が似ているだけで意味が別なら
無理に共通化しない（誤った抽象化の方が重複より害が大きい）。

```typescript
// 悪い例: 同じバリデーションルールが3箇所に散らばっている
// user.service.ts, order.service.ts, admin.service.ts それぞれで
if (!email.includes('@') || email.length > 255) { throw new ValidationError(...) }

// 良い例: 共通の知識として1箇所に抽出
// validators/email.ts
export function validateEmail(email: string): void {
  if (!email.includes('@') || email.length > 255) {
    throw new ValidationError('INVALID_EMAIL', 'メールアドレスの形式が不正です');
  }
}
```

**注意（誤った共通化の回避）:** 「似ている3行」を早すぎる段階で共通化すると、
後で挙動が分岐したときに `if (context === 'admin')` のような条件分岐が
共通関数に増殖する。**同じ理由で変わる**コードだけをDRY化の対象にする。

---

## YAGNI (You Aren't Gonna Need It)

**原則:** 今要求されていない機能・抽象化・拡張ポイントを先回りして実装しない。
「将来〇〇にも対応できるように」という設計は、その将来が来るまでは推測に
すぎない。

```typescript
// 悪い例: 今は1種類の通知方法しかないのに拡張性を先回りして実装
interface NotificationStrategy { send(msg: string): Promise<void> }
class EmailNotificationStrategy implements NotificationStrategy { ... }
class NotificationStrategyFactory {
  static create(type: 'email' | 'sms' | 'push' | 'slack'): NotificationStrategy { ... }
  // sms/push/slack は今存在しない要求
}

// 良い例: 今必要なメール通知だけを実装する
async function sendOrderConfirmationEmail(order: Order): Promise<void> {
  await mailer.send({ to: order.userEmail, template: 'order-confirmation', data: order });
}
// 2つ目の通知方法が実際に必要になった時点で抽象化を導入する
```

---

## KISS (Keep It Simple, Stupid)

**原則:** 同じ問題を解決できるなら、より単純な実装を選ぶ。賢く見える実装より
次に読む人が5秒で理解できる実装を優先する。

```typescript
// 悪い例: 一行で書けることを誇示した実装
const result = arr.reduce((a, c, i, s) => (i === s.length - 1 ? [...a, c] : a.concat([c, ','])), []);

// 良い例: 素直な実装
const result = arr.join(',');
```

---

## SOLID（オブジェクト指向設計の5原則）

| 原則 | 一言でいうと | 悪い兆候 |
|---|---|---|
| **S**ingle Responsibility | 1クラス/関数は1つの理由でしか変更されない | `UserService` がDB操作・メール送信・課金処理を全部持つ |
| **O**pen/Closed | 拡張に開き、修正に閉じる | 新しい種類を増やすたびに既存の `switch` 文に手を入れる |
| **L**iskov Substitution | 派生型は基底型と置き換え可能 | サブクラスで親のメソッドを呼ぶと例外を投げる |
| **I**nterface Segregation | 使わないメソッドへの依存を強制しない | 1つのメソッドしか使わないのに巨大なインターフェースを実装させられる |
| **D**ependency Inversion | 具象ではなく抽象に依存する | ドメイン層が特定のORMクラスを直接importする |

```typescript
// 悪い例（SRP違反）: 1クラスが認証・DB操作・メール送信を兼務
class UserService {
  async register(input) {
    const hashed = await bcrypt.hash(input.password, 10);
    const user = await db.insert('users', { ...input, password: hashed });
    await sendMail(user.email, 'welcome');
    return user;
  }
}

// 良い例: 責務ごとに分離
class UserRepository { async save(user: User): Promise<void> { ... } }
class WelcomeEmailSender { async send(email: string): Promise<void> { ... } }
class RegisterUserUseCase {
  constructor(private repo: UserRepository, private mailer: WelcomeEmailSender) {}
  async execute(input: RegisterInput): Promise<User> {
    const user = await this.repo.save(User.create(input));
    await this.mailer.send(user.email);
    return user;
  }
}
```

---

## Boy Scout Rule — 触れた場所は来た時よりきれいにする

**原則:** 自分が変更したコードの周辺は、来たときより少しきれいにして去る。

**このプロジェクトでの適用範囲:** **自分の変更で不要になったコード・触った
関数のスコープ内だけ**が対象。リポジトリ全体を「ついでに」直す行為ではない
（`principles.md` の「必要な箇所だけ触る」と矛盾しないよう、範囲は常に
自分の差分の中に限定する）。

```typescript
// 悪い例: Boy Scout Ruleを口実にスコープ外まで手を入れる
// タスク: getUserById のバグ修正
// → ついでに getUsers・UserRepository・5ファイルのimport整理まで実施

// 良い例: 自分の変更で不要になった行だけ片付ける
// タスク: getUserById のバグ修正
// → 修正の過程で自分が作った未使用の一時変数だけ削除する。
//   他の気になる箇所は別提案として報告する。
```

---

## Law of Demeter（最小知識の原則）

**原則:** オブジェクトは直接の協力者としか会話しない。「知り合いの知り合い」
をたどるメソッドチェーンは、内部構造への依存を生み変更に弱くする。

```typescript
// 悪い例: 内部構造をたどるチェーン
const city = order.getCustomer().getAddress().getCity().getName();

// 良い例: Order自身に問い合わせる（内部構造はOrderの中に隠蔽）
const city = order.getShippingCityName();
```

---

## Composition over Inheritance（継承より合成）

**原則:** 「is-a」が明確でない限り継承より合成を選ぶ。継承は親クラスの変更が
全サブクラスに波及し、多段継承は追跡が困難になる。

```typescript
// 悪い例: 振る舞いの使い回しのためだけの継承
class Bird { fly() { ... } }
class Penguin extends Bird { fly() { throw new Error('飛べません'); } }
// → LSP違反も同時に起きている

// 良い例: 能力を合成で表現する
interface Swimmer { swim(): void }
interface Flyer { fly(): void }
class Penguin implements Swimmer { swim() { ... } }
class Eagle implements Swimmer, Flyer { swim() { ... } fly() { ... } }
```

---

## Command-Query Separation（CQS）

**原則:** 1つの関数は「何かを実行する（Command）」か「何かに答える（Query）」
のどちらか一方であるべき。両方を混ぜると呼び出し側が副作用を予測できない。

```typescript
// 悪い例: 値を返しつつ内部状態も変える
function getNextId(): number {
  return ++this.counter; // 参照するだけのつもりが状態を変えてしまう
}

// 良い例: Commandと Queryを分離する
function incrementCounter(): void { this.counter++; }
function getCurrentId(): number { return this.counter; }
```

---

## Fail Fast

**原則:** 不正な状態は検知した瞬間に例外を投げる。検証を先送りにすると、
不正な値がシステムの奥深くまで伝播してから原因不明のエラーになる。
詳細な実装パターンは [[error-handling]] を参照。

```typescript
// 悪い例: 不正な値のまま処理を進めてしまう
function processOrder(order: Order) {
  const total = order.items?.reduce((sum, i) => sum + i.price, 0) ?? 0;
  // items が undefined でも 0 として処理が進んでしまう
  charge(total);
}

// 良い例: 前提条件を最初に検証して即座に失敗させる
function processOrder(order: Order) {
  if (!order.items || order.items.length === 0) {
    throw new DomainError('ORDER_EMPTY', '注文に商品がありません');
  }
  const total = order.items.reduce((sum, i) => sum + i.price, 0);
  charge(total);
}
```

---

## このプロジェクトの既存ルールとの対応

| 原則 | 対応する既存ルール |
|---|---|
| Tidy First | `rules/git.md`「フォーマット修正は別コミットにする」 |
| YAGNI / KISS | `rules/principles.md` #2「シンプルに保つ」 |
| Boy Scout Rule（範囲限定） | `CLAUDE.md`「自分の変更で不要になったコードは削除する。作業前から存在するデッドコードには触れない」 |
| DRY（誤った共通化への警戒） | `CLAUDE.md`「3行程度の類似コードは早すぎる抽象化より許容する」 |

適用に迷ったときはプロジェクト固有のルールを優先する。
