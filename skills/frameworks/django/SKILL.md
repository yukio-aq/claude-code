---
name: django
description: >
  Django 6.0 のベストプラクティス・ORM パターン・N+1 対策・CBV・シグナル設計。
  backend-implementer / backend-reviewer が Django プロジェクトを
  実装・レビューするときに参照する。
---

# Django 6.0 — ベストプラクティス

> 情報収集日: 2026-08-05 / Django 6.1 / Python 3.12+
> 公式ドキュメント: https://docs.djangoproject.com/ja/6.1/

---

## バージョン情報

| 項目                  | 内容       |
| --------------------- | ---------- |
| Django バージョン     | 6.1        |
| Python 最小バージョン | 3.12+（3.14まで対応） |
| 推奨 DB               | PostgreSQL |

> **Django 6.1 の新機能**: モデルフィールドの遅延取得動作が `fetch modes` で設定可能になった（デフォルトは既存動作と同じ `FETCH_ONE`）。詳細は公式リリースノートを参照。

---

## モデル定義

```python
from django.db import models
from django.utils import timezone


class Article(models.Model):
    # --- フィールド ---
    title = models.CharField(max_length=255)
    body = models.TextField()
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 外部キー: on_delete は必須
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="articles",   # 逆引き名は明示する
    )
    tags = models.ManyToManyField("Tag", blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["published_at"]),  # よく使うフィルタにインデックス
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["author", "title"],
                name="unique_author_title",
            )
        ]

    def __str__(self) -> str:
        return self.title

    # ビジネスロジックはモデルメソッドに集約する
    def publish(self) -> None:
        self.published_at = timezone.now()
        self.save(update_fields=["published_at", "updated_at"])
```

### フィールドオプション早見表

| オプション       | 意味                         | デフォルト |
| ---------------- | ---------------------------- | ---------- |
| `null=True`      | DB に NULL を許可            | False      |
| `blank=True`     | フォームで空を許可           | False      |
| `db_index=True`  | インデックス作成             | False      |
| `unique=True`    | 一意制約                     | False      |
| `default=...`    | Python 側デフォルト          | —          |
| `db_default=...` | DB 側デフォルト（Django 5+） | —          |

> **`null` と `blank` は別物**: `null` は DB レベル、`blank` はフォームバリデーションレベル。
> 文字列フィールドに `null=True` は原則付けない（空文字と NULL の二重管理になる）。

---

## CRUD パターン

```python
# 作成 — create() が推奨（save() はシグナルあり）
article = Article.objects.create(title="Hello", author=user)

# 取得 — get_or_create / update_or_create
article, created = Article.objects.get_or_create(
    title="Hello",
    defaults={"author": user},
)

# 一覧取得 — QuerySet は遅延評価（ループや評価まで SQL 非実行）
articles = Article.objects.filter(author=user).order_by("-created_at")

# 1件取得 — DoesNotExist / MultipleObjectsReturned に注意
try:
    article = Article.objects.get(pk=pk)
except Article.DoesNotExist:
    raise Http404

# 更新 — update() は一括 SQL UPDATE（save() シグナルは呼ばれない）
Article.objects.filter(author=user).update(published_at=timezone.now())

# 部分保存 — update_fields で特定フィールドのみ UPDATE
article.title = "Updated"
article.save(update_fields=["title", "updated_at"])

# 削除
Article.objects.filter(published_at__isnull=True).delete()
```

---

## QuerySet フィルタリング

```python
from django.db.models import Q, F, Count, Avg

# 基本フィルタ（__lookups）
Article.objects.filter(title__startswith="Django")
Article.objects.filter(created_at__gte=datetime(2025, 1, 1))
Article.objects.filter(author__name__icontains="alice")  # JOIN を自動生成

# OR 条件 — Q オブジェクト
Article.objects.filter(
    Q(title__contains="Django") | Q(title__contains="Python")
)

# フィールド同士の比較 — F 式
Article.objects.filter(updated_at__gt=F("created_at"))

# アグリゲーション
from django.db.models import Count
User.objects.annotate(article_count=Count("articles")).filter(article_count__gt=5)

# values / values_list — ORM オブジェクト不要なとき
Article.objects.values("id", "title")               # dict のリスト
Article.objects.values_list("id", flat=True)        # [1, 2, 3, ...]

# exists / count — 最小限のクエリで判定
if Article.objects.filter(author=user).exists():    # ✅ count() より速い
    ...
```

---

## N+1 クエリ対策（最重要）

N+1 はパフォーマンス劣化の最大要因。必ず `select_related` / `prefetch_related` で解消する。

> **Django 6.1 での非推奨化**: `select_related()` を引数なしで呼び、非 null な関連フィールドを全選択する使い方は非推奨。フィールドを明示するか `FETCH_PEERS` fetch mode を使う。

```python
# ❌ N+1 — author を参照するたびに SELECT が発生
articles = Article.objects.all()
for article in articles:
    print(article.author.name)  # N 回クエリ！

# ✅ select_related — ForeignKey / OneToOne の JOIN（1 クエリ）
articles = Article.objects.select_related("author").all()

# ✅ prefetch_related — ManyToMany / 逆 FK の プリフェッチ（2 クエリ）
articles = Article.objects.prefetch_related("tags").all()

# ✅ 両方使う
articles = (
    Article.objects
    .select_related("author", "author__profile")
    .prefetch_related("tags", "comments")
)

# ✅ Prefetch オブジェクトで絞り込み
from django.db.models import Prefetch

articles = Article.objects.prefetch_related(
    Prefetch(
        "comments",
        queryset=Comment.objects.filter(is_approved=True).select_related("user"),
        to_attr="approved_comments",
    )
)
```

### 使い分け

| 状況                            | 方法                    |
| ------------------------------- | ----------------------- |
| ForeignKey・OneToOne（順方向）  | `select_related`        |
| ManyToMany・逆方向 FK           | `prefetch_related`      |
| フィルタ・並び替えが必要な逆 FK | `Prefetch` オブジェクト |

---

## 一括操作パターン

```python
# ✅ 一括作成 — save() × N 回より高速
Article.objects.bulk_create([
    Article(title="A", author=user),
    Article(title="B", author=user),
])

# ✅ 一括更新 — update() は SQL UPDATE。save() / シグナルは呼ばれない
Article.objects.bulk_update(articles, fields=["title", "updated_at"])

# ✅ 一括削除
Article.objects.filter(published_at__isnull=True).delete()

# ✅ 外部キー値だけ必要なときは _id を使う（追加クエリなし）
entry.blog_id    # ✅
entry.blog.id    # ❌ blog オブジェクトをロードする
```

---

## クラスベースビュー（CBV）

```python
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy


class ArticleListView(LoginRequiredMixin, ListView):
    model = Article
    template_name = "articles/list.html"
    context_object_name = "articles"
    paginate_by = 20                        # ページネーション（API 設計ルール: 上限 100）

    def get_queryset(self):
        return (
            Article.objects
            .select_related("author")       # N+1 対策
            .filter(author=self.request.user)
            .order_by("-created_at")
        )


class ArticleDetailView(DetailView):
    model = Article
    template_name = "articles/detail.html"

    def get_queryset(self):
        return Article.objects.select_related("author").prefetch_related("tags")


class ArticleCreateView(LoginRequiredMixin, CreateView):
    model = Article
    fields = ["title", "body", "tags"]
    success_url = reverse_lazy("article-list")

    def form_valid(self, form):
        form.instance.author = self.request.user
        return super().form_valid(form)


# URLconf
# path("articles/", ArticleListView.as_view(), name="article-list"),

# async CBV（Django 5.1+）
from django.views import View
from django.http import HttpResponse

class AsyncArticleView(View):
    async def get(self, request, pk):
        article = await Article.objects.aget(pk=pk)
        return HttpResponse(article.title)
```

---

## マイグレーション

```bash
# 開発フロー
python manage.py makemigrations   # マイグレーションファイル生成
python manage.py migrate          # DB に適用

# マイグレーション確認
python manage.py showmigrations
python manage.py sqlmigrate app_name 0001

# ロールバック
python manage.py migrate app_name 0001  # 1 つ前に戻す
```

### マイグレーション設計の注意点

- `null=False` のフィールドを既存テーブルに追加するときは `default` を設定してから後で削除する
- 大量データのテーブルへの `ALTER` は `migrations.SeparateDatabaseAndState` で分離する
- マイグレーションファイルはコミットに含める（チームで共有）
- `squashmigrations` を定期的に実行してファイル数を管理する

---

## シグナル

シグナルは疎結合に見えるが **デバッグが難しい**。同一プロジェクト内のロジックには直接関数呼び出しを優先する。

```python
# myapp/signals.py
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from .models import Article


@receiver(post_save, sender=Article)
def on_article_saved(sender, instance, created, **kwargs):
    if created:
        send_notification.delay(instance.pk)   # 重い処理はジョブキューへ


# myapp/apps.py — AppConfig.ready() でシグナルをロード
from django.apps import AppConfig


class MyAppConfig(AppConfig):
    name = "myapp"

    def ready(self):
        import myapp.signals  # noqa: F401
```

### 組み込みシグナル早見表

| シグナル                               | タイミング             |
| -------------------------------------- | ---------------------- |
| `pre_save` / `post_save`               | `save()` の前後        |
| `pre_delete` / `post_delete`           | `delete()` の前後      |
| `m2m_changed`                          | M2M フィールドの変更時 |
| `request_started` / `request_finished` | リクエストの開始・終了 |

> **注意**: `QuerySet.update()` / `QuerySet.delete()` では `pre_save`/`post_save` シグナルは発火しない。

---

## よくある落とし穴

### `save()` でなく `create()` を使い忘れる

```python
# ❌ save() だと post_save シグナルに created=False が渡る場合がある
article = Article(title="test")
article.save()

# ✅ create() を使う
article = Article.objects.create(title="test")
```

### `CharField` / `TextField` に `null=True` を付ける

```python
# ❌ 空文字と NULL の二重管理になる
name = models.CharField(max_length=100, null=True, blank=True)

# ✅ 空文字のみで管理（null 不要）
name = models.CharField(max_length=100, blank=True, default="")
```

### `QuerySet` を再評価する

```python
# ❌ 同じ QuerySet を 2 回評価 → DB クエリ 2 回
print([e.title for e in Article.objects.all()])
print([e.body for e in Article.objects.all()])

# ✅ 変数に保存してキャッシュを再利用
articles = Article.objects.all()
print([e.title for e in articles])
print([e.body for e in articles])
```

### `bulk_create` / `update` でシグナルが呼ばれないことを忘れる

```python
# ❌ post_save シグナルを期待していると動かない
Article.objects.filter(pk=1).update(title="New")   # post_save 発火しない

# ✅ シグナルが必要なら個別 save() を使う
article = Article.objects.get(pk=1)
article.title = "New"
article.save(update_fields=["title"])   # post_save 発火する
```

### ループ内でクエリを実行する（N+1）

```python
# ❌ N+1
for article in Article.objects.all():
    print(article.author.name)   # 毎回 SELECT

# ✅
for article in Article.objects.select_related("author").all():
    print(article.author.name)   # 1 クエリ
```

---

## レビュー観点（backend-reviewer 向け）

- [ ] モデルの `__str__` が定義されているか
- [ ] `ForeignKey` に `on_delete` と `related_name` が設定されているか
- [ ] 頻繁にフィルタするフィールドに `db_index=True` / `Meta.indexes` があるか
- [ ] `CharField` / `TextField` に不要な `null=True` が付いていないか
- [ ] N+1 クエリが発生していないか（`select_related` / `prefetch_related` の使用）
- [ ] ループ内でクエリを実行していないか
- [ ] 一覧取得に `paginate_by` または手動ページネーションがあるか（上限 100 件）
- [ ] `bulk_create` / `update()` を使うべきところで個別 `save()` を使っていないか
- [ ] シグナルのレシーバが `AppConfig.ready()` で登録されているか
- [ ] `update()` / `delete()` でシグナルが呼ばれないことを考慮しているか
- [ ] マイグレーションファイルが生成・コミットされているか
- [ ] `django-debug-toolbar` 等でクエリ数を確認したか
