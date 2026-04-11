---
name: clean-architecture
description: クリーンアーキテクチャの層構造・依存関係ルール・実装パターン。architect / planner / backend-implementer / backend-reviewer が参照する。DDDと組み合わせて使う。
---

# クリーンアーキテクチャ

> 情報収集日: 2026-03-31

## 依存関係のルール

**内側の層は外側の層を知ってはいけない。依存は常に内側へ向かう。**

```
┌──────────────────────────────────────────────────┐
│  Infrastructure（外側）                            │
│  DB・外部API・フレームワーク・UI                    │
│  ┌────────────────────────────────────────────┐   │
│  │  Interface Adapters                         │   │
│  │  Controller・Presenter・Gateway・Mapper      │   │
│  │  ┌──────────────────────────────────────┐  │   │
│  │  │  Application（Use Cases）             │  │   │
│  │  │  ユースケース・アプリケーションサービス   │  │   │
│  │  │  ┌──────────────────────────────┐    │  │   │
│  │  │  │  Domain（最内側）              │    │  │   │
│  │  │  │  Entity・Value Object・         │    │  │   │
│  │  │  │  Domain Service・Repository IF  │    │  │   │
│  │  │  └──────────────────────────────┘    │  │   │
│  │  └──────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘

依存の方向: Infrastructure → Interface Adapters → Application → Domain
```

---

## 各層の責務

### Domain層（最内側）

- **依存するもの:** なし（外部ライブラリに依存してはいけない）
- **含むもの:** Entity・Value Object・Aggregate・Domain Event・Repository Interface・Domain Service

```typescript
// src/domain/order/order.entity.ts
// ← import は Domain層内のものだけ
import { OrderId } from './order-id.vo';
import { OrderItem } from './order-item.entity';
import { Money } from '../shared/money.vo';
import { DomainError } from '../shared/domain-error';

export class Order {
  confirm(): void { ... }  // ビジネスロジック
}

// src/domain/order/order.repository.ts
// ← インターフェースのみ。実装はInfrastructure層
export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
```

### Application層（Use Cases）

- **依存するもの:** Domain層のみ
- **含むもの:** Use Case・Application Service・DTO・イベントハンドラ

```typescript
// src/application/order/confirm-order.usecase.ts
import { OrderRepository } from '../../domain/order/order.repository';  // ← Domain
import { EventBus } from '../../domain/shared/event-bus';               // ← Domain

// DTO: 外部とのデータ受け渡し用（ドメインオブジェクトを直接渡さない）
export type ConfirmOrderCommand = {
  orderId: string;
  userId: string;
};

export type ConfirmOrderResult = {
  orderId: string;
  totalAmount: number;
  confirmedAt: string;
};

export class ConfirmOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,  // ← Interface注入
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ConfirmOrderCommand): Promise<ConfirmOrderResult> {
    const order = await this.orderRepository.findById(OrderId.from(command.orderId));
    if (!order) throw new NotFoundError('Order');

    order.confirm();
    await this.orderRepository.save(order);

    for (const event of order.pullEvents()) {
      await this.eventBus.publish(event);
    }

    return {
      orderId: order.id.toString(),
      totalAmount: order.totalAmount.value,
      confirmedAt: new Date().toISOString(),
    };
  }
}
```

### Interface Adapters層

- **依存するもの:** Application層・Domain層
- **含むもの:** Controller・Mapper・Presenter・Gateway（外部サービスのアダプタ）

```typescript
// src/interface/http/order.controller.ts
import { ConfirmOrderUseCase } from '../../application/order/confirm-order.usecase';

export class OrderController {
  constructor(private readonly confirmOrderUseCase: ConfirmOrderUseCase) {}

  async confirmOrder(req: Request, res: Response): Promise<void> {
    // HTTP→UseCaseのデータ変換
    const result = await this.confirmOrderUseCase.execute({
      orderId: req.params.id,
      userId: req.user.id,
    });
    // UseCaseの結果→HTTPレスポンスの変換
    res.json({ success: true, data: result });
  }
}

// src/interface/gateway/stripe.gateway.ts
// 外部サービスのアダプタ（Application層のインターフェースを実装）
import { PaymentGateway } from '../../application/payment/payment.gateway';

export class StripePaymentGateway implements PaymentGateway {
  async charge(amount: Money, card: CardInfo): Promise<PaymentResult> {
    // Stripe固有の実装
  }
}
```

### Infrastructure層（最外側）

- **依存するもの:** すべての層（ただし依存は内向き）
- **含むもの:** Repository実装・DBクライアント・ORM設定・DI設定・フレームワーク設定

```typescript
// src/infrastructure/persistence/drizzle-order.repository.ts
import { OrderRepository } from '../../domain/order/order.repository';  // ← Domain IF

export class DrizzleOrderRepository implements OrderRepository {
  async findById(id: OrderId): Promise<Order | null> {
    const row = await this.db.query.orders.findFirst({ ... });
    return row ? OrderMapper.toDomain(row) : null;  // ← DBモデル→Domainへの変換
  }
}

// src/infrastructure/di/container.ts
// 依存注入の設定（外側がすべてを知っている）
export const container = {
  orderRepository: new DrizzleOrderRepository(db),
  confirmOrderUseCase: new ConfirmOrderUseCase(
    container.orderRepository,
    eventBus,
  ),
  orderController: new OrderController(container.confirmOrderUseCase),
};
```

---

## ディレクトリ構造

```
src/
├── domain/                        # 最内側（外部依存なし）
│   ├── order/
│   │   ├── order.entity.ts
│   │   ├── order-item.entity.ts
│   │   ├── order-id.vo.ts
│   │   ├── order-status.vo.ts
│   │   ├── order.repository.ts    # Interface のみ
│   │   └── order-confirmed.event.ts
│   └── shared/
│       ├── money.vo.ts
│       ├── domain-error.ts
│       └── event-bus.ts           # Interface のみ
│
├── application/                   # Use Cases
│   ├── order/
│   │   ├── confirm-order.usecase.ts
│   │   ├── create-order.usecase.ts
│   │   └── get-order.usecase.ts
│   └── shared/
│       └── not-found-error.ts
│
├── interface/                     # Adapters
│   ├── http/
│   │   └── order.controller.ts
│   ├── gateway/
│   │   └── stripe.gateway.ts
│   └── mapper/
│       └── order.mapper.ts
│
└── infrastructure/                # 最外側
    ├── persistence/
    │   └── drizzle-order.repository.ts
    ├── messaging/
    │   └── in-memory-event-bus.ts
    └── di/
        └── container.ts
```

---

## Dependency Inversion の実装

外側の実装を内側のインターフェースに合わせる（逆転させる）。

```typescript
// ❌ Domain層がDBを直接知っている（依存関係の違反）
import { db } from '../infrastructure/db';  // ← 内側が外側を知っている

class Order {
  async save(): Promise<void> {
    await db.insert(orders).values(this.toData());
  }
}

// ✅ インターフェースを通じて逆転させる
// Domain層: インターフェースを定義
interface OrderRepository {
  save(order: Order): Promise<void>;
}

// Infrastructure層: インターフェースを実装
class DrizzleOrderRepository implements OrderRepository {
  async save(order: Order): Promise<void> {
    await db.insert(orders).values(OrderMapper.toPersistence(order));
  }
}

// Application層: インターフェースに依存（実装を知らない）
class ConfirmOrderUseCase {
  constructor(private readonly repo: OrderRepository) {}  // ← IFのみ
}
```

---

## DDDとの組み合わせ

| DDD概念 | クリーンアーキテクチャの層 |
|---|---|
| Entity・Value Object・Aggregate | Domain層 |
| Domain Service | Domain層 |
| Repository Interface | Domain層 |
| Use Case / Application Service | Application層 |
| Repository 実装 | Infrastructure層 |
| Controller | Interface Adapters層 |
| Domain Event の発行 | Application層 |
| Domain Event のハンドラ | Application層 または Infrastructure層 |

---

## よくある間違い

```typescript
// ❌ Use CaseがORMモデルを返す（層の境界を越えている）
class GetOrderUseCase {
  async execute(id: string) {
    return await db.query.orders.findFirst({ ... });  // ← DBモデルをそのまま返す
  }
}

// ✅ DTOに変換して返す
class GetOrderUseCase {
  async execute(id: string): Promise<OrderDTO> {
    const order = await this.orderRepository.findById(OrderId.from(id));
    return OrderDTO.from(order);  // ← Domain → DTOに変換
  }
}

// ❌ Controller にビジネスロジックを書く
class OrderController {
  async confirm(req: Request, res: Response) {
    const order = await db.query.orders.findFirst({ ... });
    if (order.items.length === 0) throw new Error('...');  // ← ビジネスロジック
    order.status = 'CONFIRMED';
    await db.update(orders).set(order);
  }
}
```
