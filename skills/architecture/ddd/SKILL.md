---
name: ddd
description: ドメイン駆動設計（DDD）の戦略・戦術パターン。architect / planner / backend-implementer / backend-reviewer が参照する。
---

# ドメイン駆動設計（DDD）

> 情報収集日: 2026-03-31

## 戦略的設計

### Ubiquitous Language（ユビキタス言語）

ドメインエキスパートと開発者が共通して使う言語をコードに反映する。

```typescript
// ❌ 技術的な言葉で書く
class UserRecord {
  updateData(fields: object) { ... }
}

// ✅ ドメインの言葉で書く
class Customer {
  changeShippingAddress(address: Address) { ... }
  placeOrder(items: OrderItem[]): Order { ... }
}
```

### Bounded Context（境界づけられたコンテキスト）

1つのモデルが有効な範囲を明確に区切る。同じ「User」でも文脈が違えば別モデル。

```
ECサイトの例:

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  注文コンテキスト  │    │  在庫コンテキスト  │    │  配送コンテキスト  │
│                 │    │                 │    │                 │
│  Customer       │    │  StockItem      │    │  Shipment       │
│  Order          │    │  Warehouse      │    │  Recipient      │
│  OrderItem      │    │  Reservation    │    │  TrackingCode   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ↕ Context Map で関係を定義
```

```
# ディレクトリ構造
src/
├── ordering/        # 注文コンテキスト
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── inventory/       # 在庫コンテキスト
└── shipping/        # 配送コンテキスト
```

---

## 戦術的設計

### Entity（エンティティ）

**同一性（ID）** によって区別されるオブジェクト。状態が変化しても同じものとして扱う。

```typescript
class Order {
  // IDで同一性を定義
  constructor(
    private readonly id: OrderId,
    private customerId: CustomerId,
    private items: OrderItem[],
    private status: OrderStatus,
  ) {}

  // ビジネスロジックをエンティティ内に持つ
  addItem(item: OrderItem): void {
    if (this.status !== OrderStatus.DRAFT) {
      throw new DomainError('INVALID_ORDER_STATE', '確定済みの注文には追加できません');
    }
    this.items.push(item);
  }

  confirm(): void {
    if (this.items.length === 0) {
      throw new DomainError('EMPTY_ORDER', '商品が1件もありません');
    }
    this.status = OrderStatus.CONFIRMED;
    // Domain Eventを発行
    this.addEvent(new OrderConfirmed(this.id, new Date()));
  }

  // IDによる等値比較
  equals(other: Order): boolean {
    return this.id === other.id;
  }
}
```

### Value Object（値オブジェクト）

**値** によって区別されるオブジェクト。不変・交換可能。

```typescript
// ❌ プリミティブ値をそのまま使う（型安全でない・バリデーションが散らばる）
function createOrder(email: string, amount: number) { ... }

// ✅ Value Objectで意味と制約を持たせる
class Email {
  private constructor(private readonly value: string) {}

  static create(value: string): Email {
    if (!value.includes('@')) {
      throw new DomainError('INVALID_EMAIL', 'メールアドレスの形式が正しくありません');
    }
    return new Email(value.toLowerCase());
  }

  toString(): string { return this.value; }

  equals(other: Email): boolean { return this.value === other.value; }
}

class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {}

  static of(amount: number, currency: string): Money {
    if (amount < 0) throw new DomainError('NEGATIVE_AMOUNT', '金額は0以上である必要があります');
    return new Money(amount, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new DomainError('CURRENCY_MISMATCH', '異なる通貨は加算できません');
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}
```

### Aggregate（集約）

**整合性の境界**。Aggregate Rootを通じてのみ内部にアクセスする。

```typescript
// Order が Aggregate Root（OrderItem は Order を通じてのみ操作する）
class Order {  // ← Aggregate Root
  private items: OrderItem[] = [];  // ← Aggregate内部

  // ✅ 外部から直接 items を操作させない
  addItem(productId: ProductId, quantity: number, price: Money): void {
    const existingItem = this.items.find(i => i.productId.equals(productId));
    if (existingItem) {
      existingItem.increaseQuantity(quantity);
    } else {
      this.items.push(new OrderItem(productId, quantity, price));
    }
  }

  get totalAmount(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.subTotal),
      Money.of(0, 'JPY'),
    );
  }
}

// ❌ Aggregate内部に直接アクセス
orderRepository.findById(id).items.push(newItem);

// ✅ Aggregate Rootのメソッドを経由
const order = await orderRepository.findById(id);
order.addItem(productId, quantity, price);
await orderRepository.save(order);
```

### Domain Event（ドメインイベント）

**ビジネス上重要な出来事** を表す。コンテキスト間の疎結合な連携に使う。

```typescript
// イベントの定義
class OrderConfirmed {
  readonly occurredAt: Date;

  constructor(
    readonly orderId: OrderId,
    readonly customerId: CustomerId,
    readonly totalAmount: Money,
  ) {
    this.occurredAt = new Date();
  }
}

// Aggregateでイベントを発行
class Order {
  private _events: DomainEvent[] = [];

  confirm(): void {
    this.status = OrderStatus.CONFIRMED;
    this._events.push(
      new OrderConfirmed(this.id, this.customerId, this.totalAmount)
    );
  }

  pullEvents(): DomainEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }
}

// Application層でイベントを処理
class ConfirmOrderUseCase {
  async execute(orderId: OrderId): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    order.confirm();
    await this.orderRepository.save(order);

    // イベントを取り出して発行
    for (const event of order.pullEvents()) {
      await this.eventBus.publish(event);
    }
  }
}
```

### Repository（リポジトリ）

**Aggregateの永続化を抽象化する**。ドメイン層はインターフェースのみ知る。

```typescript
// ドメイン層: インターフェースのみ定義（DBを知らない）
interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: CustomerId): Promise<Order[]>;
  save(order: Order): Promise<void>;
  delete(id: OrderId): Promise<void>;
}

// インフラ層: 実装（DBを知っている）
class DrizzleOrderRepository implements OrderRepository {
  async findById(id: OrderId): Promise<Order | null> {
    const row = await this.db.query.orders.findFirst({
      where: eq(orders.id, id.toString()),
      with: { items: true },
    });
    return row ? OrderMapper.toDomain(row) : null;
  }

  async save(order: Order): Promise<void> {
    const data = OrderMapper.toPersistence(order);
    await this.db.insert(orders).values(data).onConflictDoUpdate({ ... });
  }
}
```

### Domain Service vs Application Service

```typescript
// Domain Service: ドメインロジックを持つが、特定のEntityに属さない処理
class PricingService {
  // 複数のAggregateにまたがる計算はDomain Serviceに置く
  calculateDiscountedPrice(
    customer: Customer,
    order: Order,
    campaign: Campaign,
  ): Money {
    const baseDiscount = customer.membershipLevel.discountRate;
    const campaignDiscount = campaign.isApplicable(order) ? campaign.discountRate : 0;
    return order.totalAmount.multiply(1 - Math.max(baseDiscount, campaignDiscount));
  }
}

// Application Service (Use Case): ユースケースの調整役。ドメインロジックは持たない
class ConfirmOrderUseCase {
  async execute(command: ConfirmOrderCommand): Promise<void> {
    // 1. 取得
    const order = await this.orderRepository.findById(command.orderId);
    if (!order) throw new NotFoundError('Order');

    // 2. ドメインロジックの実行（Application Serviceはここを委譲するだけ）
    const discountedAmount = this.pricingService.calculateDiscountedPrice(
      await this.customerRepository.findById(order.customerId),
      order,
      await this.campaignRepository.findActive(),
    );
    order.confirm(discountedAmount);

    // 3. 永続化・イベント発行
    await this.orderRepository.save(order);
  }
}
```

---

## よくある間違い

```typescript
// ❌ ドメインロジックをService層に書く（Anemic Domain Model）
class OrderService {
  async confirmOrder(orderId: string): Promise<void> {
    const order = await this.orderRepo.findById(orderId);
    if (order.items.length === 0) throw new Error('Empty');
    order.status = 'CONFIRMED';  // ← ドメインロジックがServiceに漏れている
    await this.orderRepo.save(order);
  }
}

// ✅ ドメインロジックはEntityに持たせる
class Order {
  confirm(): void {
    if (this.items.length === 0) throw new DomainError('EMPTY_ORDER', '...');
    this.status = OrderStatus.CONFIRMED;
  }
}
```
