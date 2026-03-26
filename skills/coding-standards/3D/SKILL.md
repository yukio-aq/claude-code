---
name: 3d-coding-standards
description: Three.js/React Three Fiber/Unityの3Dコーディングスタンダード。3d-implementer / 3d-reviewer が参照する。
---

# 3D コーディングスタンダード（Three.js / R3F / Unity）

## Three.js / React Three Fiber

### メモリ管理（最重要）

```typescript
// ✅ useEffectでdisposeを必ず実装
const Scene = () => {
  const geometryRef = useRef(new THREE.BoxGeometry());
  const materialRef = useRef(new THREE.MeshStandardMaterial());

  useEffect(() => {
    return () => {
      geometryRef.current.dispose();
      materialRef.current.dispose();
    };
  }, []);
};

// ✅ R3F: useTextureでテクスチャを共有（重複ロード防止）
const texture = useTexture("/texture.jpg");
```

### useFrame のルール

```typescript
// ❌ useFrame内でオブジェクトを生成しない（毎フレームGCが走る）
useFrame(() => {
  mesh.current.position.add(new THREE.Vector3(0, 0.01, 0)); // NG
});

// ✅ useMemoで事前に生成して再利用する
const vec = useMemo(() => new THREE.Vector3(), []);
useFrame((_, delta) => {
  vec.set(0, delta * 0.5, 0);
  mesh.current.position.add(vec);
});
```

### パフォーマンスチェックリスト

- ドローコールは100以下（`<Stats />`で確認）
- 同一メッシュの大量描画には `<Instances>` を使う
- アニメーションは `delta` で時間正規化（フレームレート依存を防ぐ）
- テクスチャのサイズは2の累乗（512, 1024, 2048）にする

---

## Unity（C#）

### Update() のルール

```csharp
// ❌ Update内でのアロケーションはGCスパイクの原因
void Update() {
  var enemies = new List<Enemy>(); // 毎フレーム生成 → NG
  string msg = "Position: " + transform.position; // 文字列結合 → NG
}

// ✅ フィールドで保持・再利用する
private readonly List<Enemy> _enemies = new List<Enemy>();
private readonly StringBuilder _sb = new StringBuilder();

void Update() {
  _enemies.Clear();
  FindEnemiesInRange(_enemies);

  _sb.Clear();
  _sb.Append("Position: ").Append(transform.position);
}
```

### キャッシュの活用

```csharp
// ✅ よく使うコンポーネントはAwakeでキャッシュする
private Transform _transform;
private Rigidbody _rigidbody;
private Camera _mainCamera;

void Awake() {
  _transform = transform;
  _rigidbody = GetComponent<Rigidbody>();
  _mainCamera = Camera.main; // Camera.mainは毎回検索が走る
}
```

### パフォーマンスチェックリスト

- Profilerで `GC.Alloc` が0に近いことを確認
- Static Batchingで静的オブジェクトのDrawCallを削減
- GPU Instancingで同一メッシュの大量描画を最適化
- テクスチャはAtlasにまとめてDrawCallを削減
- `Camera.main` はキャッシュして使う
