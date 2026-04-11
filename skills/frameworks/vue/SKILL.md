---
name: vue
description: >
  Vue.js 3.x (Composition API / Vite / Pinia) の実装パターン。
  frontend-implementer / frontend-reviewer / architect が
  Vue アプリケーションを設計・実装・レビューするときに参照する。
---

# Vue.js 3.x — 実装スキル

> 公式ドキュメント: https://ja.vuejs.org/
> 情報収集日: 2026-03-31
> 推奨ツール: Vite, Pinia, Vue Router, Volar (Extension)

---

## 基本原則

- **Composition API 優先**: `<script setup>` 構文を使用し、ロジックを Composable (`src/composables`) に抽出する。
- **SFC (Single File Component)**: `.vue` ファイルでテンプレート、ロジック、スタイルを管理する。
- **TypeScript 必須**: `lang="ts"` を指定し、型安全な開発を行う。

---

## ディレクトリ構成（推奨）

```
src/
├── assets/         # 静的アセット（画像、グローバルCSS）
├── components/     # 再利用可能なUIコンポーネント
│   ├── ui/         # 汎用的なアトミックコンポーネント
│   └── feature/    # 特定機能に関連するコンポーネント
├── composables/    # 状態を持つ再利用可能なロジック
├── layouts/        # ページレイアウト
├── pages/ or views/# ページコンポーネント
├── router/         # ルーティング設定
├── stores/         # 状態管理 (Pinia)
├── types/          # TypeScript の型定義
└── utils/          # 純粋なユーティリティ関数
```

---

## Composition API (`<script setup>`)

### 基本構文

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// Props
const props = defineProps<{
  title: string
  count?: number
}>()

// Emits
const emit = defineEmits<{
  (e: 'change', id: number): void
}>()

// State
const count = ref(0)

// Computed
const doubled = computed(() => count.value * 2)

// Methods
const increment = () => {
  count.value++
  emit('change', count.value)
}
</script>

<template>
  <div>
    <h1>{{ title }}</h1>
    <button @click="increment">Count: {{ count }} (Double: {{ doubled }})</button>
  </div>
</template>
```

---

## 状態管理 (Pinia)

Vuex ではなく Pinia を使用する。

```typescript
// src/stores/user.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const name = ref('Guest')
  const isLoggedIn = computed(() => name.value !== 'Guest')

  function setName(newName: string) {
    name.value = newName
  }

  return { name, isLoggedIn, setName }
})
```

---

## コンポーネント設計

### Props & Emits の規約

- **Props**: `camelCase` で定義し、テンプレート内では `kebab-case` で渡す（Vue 規約）。
- **Emit**: イベント名は `kebab-case` 推奨。

### ロジックの分離 (Composables)

コンポーネントが肥大化する場合、ロジックを Composable に抽出する。

```typescript
// src/composables/useCounter.ts
import { ref, computed } from 'vue'

export function useCounter(initialValue = 0) {
  const count = ref(initialValue)
  const doubled = computed(() => count.value * 2)
  const increment = () => count.value++

  return { count, doubled, increment }
}
```

---

## ルーティング (Vue Router)

```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/pages/Home.vue'), // Lazy Loading
    },
    {
      path: '/user/:id',
      component: () => import('@/pages/UserProfile.vue'),
      props: true, // URL パラメータを Props として受け取る
    }
  ]
})
```

---

## パフォーマンス最適化

- **`v-show` vs `v-if`**: 頻繁に切り替わる要素には `v-show` を使用。
- **`v-once`**: データの変更を追跡する必要がない静的なコンテンツに使用し、更新コストを削減する。
- **`v-memo`**: 巨大なリストや複雑なサブツリーの更新を条件付きでスキップする。
- **`shallowRef` / `shallowReactive`**: 巨大でネストの深いオブジェクト（10万プロパティ以上など）において、リアクティビティのプロキシ・オーバーヘッドを削減するために使用する。
- **仮想リスト (Virtualization)**: 数千件以上のリストを表示する場合は、`vue-virtual-scroller` 等を使用して表示領域外のノードを描画しない。
- **Prop の安定性**: 子コンポーネントに渡す Prop を安定させ、不必要な再レンダリングを防ぐ。

---

## アクセシビリティ (A11y)

- **Skip Links**: ページの先頭にメインコンテンツへジャンプするリンクを設ける。
- **セマンティックな構造**: `<h1>`-`<h6>` の階層を正しく守り、`role="main"`, `role="navigation"` 等のランドマークを活用する。
- **フォームのラベル**: すべての入力項目に `<label>` を関連付け、視覚的に隠す場合もスクリーンリーダーが認識できるようにする。
- **ARIA 属性**: `aria-label`, `aria-labelledby`, `aria-describedby` を適切に使用して、動的な状態を伝える。

---

## セキュリティ

- **信頼できないテンプレートの禁止**: ユーザーが入力した文字列をコンポーネントのテンプレートとして動的にコンパイルしない。
- **`v-html` の制限**: 信頼できるソース（サニタイズ済み）以外には絶対に使用しない。
- **URL/スタイルインジェクション**: `javascript:` スキームの URL や、ユーザー入力による `<style>` タグへの直接注入を避ける。
- **最新バージョンの維持**: Vue 本体および関連ライブラリを常に最新に保ち、既知の脆弱性に対応する。

---

## レビュー観点

- [ ] `<script setup>` が使われているか
- [ ] ロジックが適切に Composable に分離されているか
- [ ] Props の型定義に `defineProps` が使われているか
- [ ] `v-for` に適切な `key` が設定されているか
- [ ] Pinia ストアが巨大化しすぎていないか（機能ごとに分割されているか）
- [ ] スタイルに `scoped` が付与されているか
