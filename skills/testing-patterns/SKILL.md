---
description: テスト設計パターン（Test Double・テストデータビルダー・依存注入）。test-implementer / qa-engineer / *-reviewer が参照する。
---

# テスト設計パターン

## Test Double の使い分け

| 種類 | 用途 | いつ使うか |
|---|---|---|
| **Stub** | 固定値を返す | 外部依存の戻り値を制御したいとき |
| **Spy** | 呼び出しを記録する | メソッドが呼ばれたか・何回呼ばれたかを検証したいとき |
| **Mock** | 期待通りに呼ばれなければ失敗 | 特定の呼び出しが必須であることを強制したいとき |
| **Fake** | 動作する軽量実装 | 本物に近い動作が必要なとき（インメモリDB等） |
| **Dummy** | 渡すだけで使われない | 引数を埋める必要があるが検証に関係しないとき |

```typescript
// Stub: 固定値を返す
const userRepositoryStub: UserRepository = {
  findById: async () => ({ id: 'user-1', name: 'テストユーザー', email: 'test@example.com' }),
  save: async () => {},
};

// Spy: 呼び出しを記録する
const calls: string[] = [];
const emailServiceSpy = {
  send: async (to: string) => { calls.push(to); },
};
// 検証
expect(calls).toContain('test@example.com');

// Fake: 動作する軽量実装（テスト全体で再利用できる）
class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async save(user: User): Promise<void> {
    this.store.set(user.id, user);
  }
}
```

---

## テストデータビルダーパターン

テストデータを可読性高く・柔軟に生成する。

```typescript
// ❌ テストデータがハードコードされ、変更に弱い
const user = {
  id: 'user-1',
  name: 'テストユーザー',
  email: 'test@example.com',
  role: 'user',
  createdAt: new Date('2024-01-01'),
  // ... 10項目以上続く
};

// ✅ ビルダーパターンで必要な部分だけ上書き
class UserBuilder {
  private data: User = {
    id: 'user-default',
    name: 'デフォルトユーザー',
    email: 'default@example.com',
    role: 'user',
    createdAt: new Date('2024-01-01'),
  };

  withId(id: string): this {
    this.data = { ...this.data, id };
    return this;
  }

  withRole(role: UserRole): this {
    this.data = { ...this.data, role };
    return this;
  }

  asAdmin(): this {
    return this.withRole('admin');
  }

  build(): User {
    return { ...this.data };
  }
}

// テストでの使い方
const adminUser = new UserBuilder().withId('admin-1').asAdmin().build();
const normalUser = new UserBuilder().build();

// 工場関数スタイル（シンプルな場合）
const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  name: 'テストユーザー',
  email: 'test@example.com',
  role: 'user',
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

const adminUser = buildUser({ role: 'admin' });
```

---

## ドメインロジックのユニットテスト

DDDのEntityはピュアな関数として書けるのでテストしやすい。

```typescript
describe('Order', () => {
  describe('confirm', () => {
    it('should confirm when items exist', () => {
      // Arrange
      const order = new OrderBuilder()
        .withItems([new OrderItemBuilder().build()])
        .build();

      // Act
      order.confirm();

      // Assert
      expect(order.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should throw DomainError when order is empty', () => {
      // Arrange
      const order = new OrderBuilder().withItems([]).build();

      // Act & Assert
      expect(() => order.confirm()).toThrow(DomainError);
      expect(() => order.confirm()).toThrow('EMPTY_ORDER');
    });

    it('should publish OrderConfirmed event after confirming', () => {
      // Arrange
      const order = new OrderBuilder()
        .withItems([new OrderItemBuilder().build()])
        .build();

      // Act
      order.confirm();

      // Assert
      const events = order.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(OrderConfirmed);
    });
  });
});
```

---

## Use Caseのテスト

Application層はFakeリポジトリを使ってテストする。

```typescript
describe('ConfirmOrderUseCase', () => {
  let orderRepository: InMemoryOrderRepository;
  let eventBus: InMemoryEventBus;
  let useCase: ConfirmOrderUseCase;

  beforeEach(() => {
    // Fake実装でセットアップ
    orderRepository = new InMemoryOrderRepository();
    eventBus = new InMemoryEventBus();
    useCase = new ConfirmOrderUseCase(orderRepository, eventBus);
  });

  it('should confirm order and publish event', async () => {
    // Arrange
    const order = new OrderBuilder()
      .withId('order-1')
      .withItems([new OrderItemBuilder().build()])
      .build();
    await orderRepository.save(order);

    // Act
    await useCase.execute({ orderId: 'order-1', userId: 'user-1' });

    // Assert: 永続化されたか
    const saved = await orderRepository.findById('order-1');
    expect(saved?.status).toBe(OrderStatus.CONFIRMED);

    // Assert: イベントが発行されたか
    expect(eventBus.publishedEvents).toContainEqual(
      expect.objectContaining({ orderId: 'order-1' })
    );
  });

  it('should throw NotFoundError when order does not exist', async () => {
    await expect(
      useCase.execute({ orderId: 'not-exist', userId: 'user-1' })
    ).rejects.toThrow(NotFoundError);
  });
});
```

---

## テスト可能な設計にするための依存注入

```typescript
// ❌ 依存をハードコード（テスト困難）
class ConfirmOrderUseCase {
  private readonly repo = new DrizzleOrderRepository(db);  // ← 差し替え不可

  async execute(command: ConfirmOrderCommand): Promise<void> { ... }
}

// ✅ コンストラクタ注入（テストでFakeを差し込める）
class ConfirmOrderUseCase {
  constructor(
    private readonly repo: OrderRepository,    // ← Interface
    private readonly eventBus: EventBus,        // ← Interface
  ) {}

  async execute(command: ConfirmOrderCommand): Promise<void> { ... }
}

// 本番: 実装を注入
const useCase = new ConfirmOrderUseCase(
  new DrizzleOrderRepository(db),
  new RedisEventBus(redis),
);

// テスト: Fakeを注入
const useCase = new ConfirmOrderUseCase(
  new InMemoryOrderRepository(),
  new InMemoryEventBus(),
);
```

---

## APIエンドポイントのテスト（MSW）

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/orders/:id', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: buildOrder({ id: params.id as string }),
    });
  }),

  http.post('/api/orders/:id/confirm', () => {
    return HttpResponse.json({ success: true, data: { confirmedAt: '2024-01-01' } });
  }),
];

// テスト
describe('OrderDetail', () => {
  it('should show confirm button when order is draft', async () => {
    render(<OrderDetail orderId="order-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '注文確定' })).toBeInTheDocument();
    });
  });
});
```

---

## テストしてはいけないこと

```typescript
// ❌ フレームワークの動作をテストする
it('useState updates correctly', () => { ... });  // Reactの責任

// ❌ private メソッドをテストする
// @ts-ignore
expect(order['_validateItems']()).toBe(true);

// ❌ モックの呼び出し回数をテストする（実装詳細）
expect(mockRepo.save).toHaveBeenCalledTimes(1);  // 何回呼ぶかは実装詳細
// ✅ 代わりに結果をテストする
expect(await repo.findById('order-1')).not.toBeNull();
```
