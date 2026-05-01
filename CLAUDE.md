# CLAUDE.md
# グローバル行動指針 — テックリード向け個人設定

---

## 言語設定

- 説明・提案・質問はすべて日本語で行う
- コード・変数名・コメント・コミットメッセージは英語で書く
- ドキュメント（README、ADR）は指示に従う

---

## 返答スタイル

- **短く返す** — 結論・要点だけ。説明は求められた場合のみ
- **体言止め・箇条書き優先** — 敬語・丁寧語・接続詞は省く
- **作業後の要約を省く** — ツール呼び出し結果はユーザーも見ている。「〜しました」「完了しました」は不要
- **確認は1行** — 「〜でよいですか？」は省き「〜で進める？」程度に短縮する
- **冗長な前置きを省く** — 「承知しました」「確認します」「では」等は書かない

---

## 基本姿勢

- 実装前に必ず意図を確認する。曖昧な要件のまま進めない
- 複数の選択肢があるときは、推奨案と理由を添えて提示してから実装する
- 大きな変更をする前に「何をどう変えるか」を箇条書きで確認する
- 設計の意思決定には根拠（トレードオフ）を必ず示す
- タスクを「検証可能なゴール」に変換して渡す — 「バグを直して」ではなく「この条件で失敗するテストを書き、pass させて」のように成功条件を明示する

→ 各原則の悪例/良例は `rules/principles.md` を参照

---

## コーディングスタイル（全領域共通）

### 必ず守ること
- immutable優先 — `const` と `readonly` をデフォルトにする。`let` は本当に必要なときだけ
- 早期return — ネストを深くしない。ガード節で先に異常系を返す
- コメントは「なぜ」だけ — コードを読めばわかる「何を」は書かない
- 関数型スタイル優先 — クラスより関数、ミュータブルな状態より純粋関数

### 命名規則
- 変数・関数: camelCase
- 型・クラス・コンポーネント: PascalCase
- 定数: UPPER_SNAKE_CASE
- ファイル: kebab-case（コンポーネントは PascalCase）

### ファイルサイズ
- 1ファイル300行を超えたら分割を検討する
- 1関数50行を超えたら責務を見直す

---

## やってはいけないこと（禁止事項）

- 確認なしでのファイル削除は絶対にしない
- 既存ファイルの大規模リファクタは指示なしにしない — スコープ外の変更は提案に留める
- 自分の変更によって不要になったコードは削除する。作業前から存在するデッドコードには触れない
- 設計（ADR）外のライブラリ追加・変更はしない — 詳細は `rules/dependencies.md` を参照
- テストをスキップした実装をしない — テストが書けない設計は設計を見直す
- `any` 型の使用は原則禁止 — 使う場合はコメントで理由を明記
- `console.log` をコミットに含めない — デバッグログは削除またはloggerに置き換える

---

## エージェント活用方針

### 自動起動の原則
- 複雑なタスク（複数ファイル・複数領域にまたがる）→ まず chief-of-staff に委譲
- 要件が曖昧・未整理な場合 → requirements-analyst で要件定義書を作成してから進む
- 技術選定・設計判断 → architect を使い ADR を残す
- 実装開始前 → qa-engineer でテスト戦略を決める
- 実装後 → 必ず領域対応の *-reviewer を通す
- コミット前 → pr-author でチェック＆PR description生成

### モデル選定の原則
- 設計・判断・プロンプト設計 → Opus
  （architect / ai-agent-designer / planner / qa-engineer / ai-agent-implementer / ai-agent-reviewer / requirements-analyst）
- 実装・レビュー・ドキュメント → Sonnet（それ以外）
- コスト最適化のため、Opusは上記以外では使わない

### エージェントへの指示
- 目的のコンテキストを必ず渡す（「なぜこの作業が必要か」）
- 成果物はファイルに書き出す（次のエージェントへの引き継ぎを想定）

---

## ワークフロー

### 新機能の開発
```
0. requirements-analyst → 要件が曖昧な場合のみ。要件定義書を作成してから進む
1. planner       → 実装計画.md を作成（要件定義書を入力として渡す）
2. architect     → 技術選定が必要なら ADR を作成
3. qa-engineer   → テスト戦略を決定（テストケース一覧を先に作る）
4. *-implementer → テストを書きながら実装（TDDベース・並走）
                   実装完了時点でテストが揃っている状態を必須とする
5. test-implementer → カバレッジ計測・不足テストの補完
6. *-reviewer    → コードレビュー
7. pr-author     → コミット・PR作成
```

### バグ修正
```
1. 原因調査     → code-investigator で根本原因・影響範囲を特定
2. *-implementer → 再現テストを書いてから修正実装
3. pr-author    → コミット
```

### リファクタリング
```
1. refactor-planner    → 計画書を作成（docs/plans/ に保存）
2. test-implementer    → テストが不足していれば補完（Phase 1）
3. refactor-implementer → 計画書に従ってフェーズ単位で実行
4. architecture-reviewer → 設計品質の確認（必要に応じて）
5. pr-author           → フェーズ単位でコミット・PR作成
```

---

## テスト方針

- TDDベース・実装と常に並走する
- 実装完了時点でテストが揃っていることが必須
- 厳密にテストファーストである必要はないが、実装が終わったのにテストがない状態は許容しない
- バグ修正時は再現テストを書いてから修正する

---

## コミット規約（Conventional Commits）

```
<type>: <description>

型の一覧:
  feat     新機能
  fix      バグ修正
  refactor リファクタリング（機能変更なし）
  test     テスト追加・修正
  docs     ドキュメントのみの変更
  chore    ビルド・設定・依存関係
  perf     パフォーマンス改善
  ci       CI/CD設定

例:
  feat: add user authentication with JWT
  fix: resolve N+1 query in user list endpoint
  refactor: extract payment logic into service layer
```

---

## プロジェクト構成（このリポジトリ）

```
~/desktop/claude-code/
├── CLAUDE.md          # このファイル（グローバル指針）
├── agents/            # サブエージェント定義（34個・8カテゴリ）
├── hooks/             # 自動化スクリプト（3個）
│   ├── bash-guard.js        # PreToolUse(Bash): 危険コマンド / force push / コミット前ガード
│   ├── format-check.js      # PostToolUse(Write|Edit|MultiEdit): フォーマットチェック
│   └── session-load.js      # UserPromptSubmit: 前回セッション引き継ぎ注入
├── commands/          # スラッシュコマンド（10個）
├── rules/             # 常時適用ルール（4個）
├── skills/            # ドメイン知識・ベストプラクティス（15カテゴリ）
└── mcp-configs/       # MCPサーバー設定

# ~/.claude/ へのシンボリックリンクで有効化
# settings.json は ~/.claude/settings.json に直接記述
```

---

## セッション管理

- /save コマンドで手動保存（自動保存なし・Stop hook は廃止済み）
- 次回起動時に前回の要約を自動注入（UserPromptSubmit hook: session-load.js）
- 24時間以上前のセッションは警告付き表示
- セッションファイルはプロジェクトごとに分離