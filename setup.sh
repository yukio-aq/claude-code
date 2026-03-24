#!/bin/bash
# ~/Desktop/claude-code/setup.sh
# Claude Code 初期セットアップスクリプト

set -e  # エラーが出たら即停止

# スクリプト自身の場所からリポジトリルートを取得（クローン先によらず動作する）
CLAUDE_CODE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"

echo "🚀 Claude Code セットアップを開始します..."

# ── 1. ディレクトリ作成 ────────────────────────────────
echo ""
echo "📁 ディレクトリを作成します..."

mkdir -p "$CLAUDE_CODE_DIR"/{agents,hooks,commands,rules,skills,mcp-configs}
mkdir -p "$CLAUDE_CODE_DIR/skills"/{ai-agent-patterns,coding-standards,architecture,docs-lookup,continuous-learning}
mkdir -p "$CLAUDE_CODE_DIR/skills/continuous-learning"/{instincts,curated}
mkdir -p "$CLAUDE_DIR"

echo "  ✅ ディレクトリ作成完了"

# ── 2. Gitリポジトリ初期化 ────────────────────────────
echo ""
echo "📦 Gitリポジトリを初期化します..."

cd "$CLAUDE_CODE_DIR"

if [ ! -d ".git" ]; then
  git init
  echo "  ✅ Git初期化完了"
else
  echo "  ℹ️  既にGitリポジトリです。スキップします"
fi

# ── 3. .gitignore 作成 ────────────────────────────────
echo ""
echo "🔒 .gitignore を確認します..."

if [ -f "$CLAUDE_CODE_DIR/.gitignore" ]; then
  echo "  ℹ️  .gitignore が既に存在します。スキップします"
else
  cat > "$CLAUDE_CODE_DIR/.gitignore" << 'EOF'
# APIキー・シークレット
.env
.env.local
*.key
secrets/

# セッションファイル（プロジェクト側で管理）
**/sessions/

# OS
.DS_Store
Thumbs.db

# Node
node_modules/
EOF
  echo "  ✅ .gitignore 作成完了"
fi

# ── 4. シンボリックリンク作成 ──────────────────────────
echo ""
echo "🔗 シンボリックリンクを作成します..."

# 既存のシンボリックリンク・ディレクトリを確認してから作成
for dir in agents hooks commands rules skills; do
  target="$CLAUDE_DIR/$dir"
  source="$CLAUDE_CODE_DIR/$dir"

  if [ -L "$target" ]; then
    echo "  ℹ️  $dir: 既存のリンクを更新します"
    rm "$target"
  elif [ -d "$target" ]; then
    echo "  ⚠️  $dir: 既存のディレクトリが見つかりました"
    echo "       バックアップ先: $CLAUDE_DIR/${dir}.backup"
    mv "$target" "$CLAUDE_DIR/${dir}.backup"
  fi

  ln -s "$source" "$target"
  echo "  ✅ $dir → $source"
done

# ── 5. settings.json 作成（存在しない場合のみ）─────────
echo ""
echo "⚙️  settings.json を設定します..."

SETTINGS_FILE="$CLAUDE_DIR/settings.json"

if [ -f "$SETTINGS_FILE" ]; then
  echo "  ℹ️  settings.json が既に存在します。スキップします"
  echo "       手動で $SETTINGS_FILE にHook設定を追加してください"
else
  cat > "$SETTINGS_FILE" << EOF
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [{
          "type": "command",
          "command": "node $CLAUDE_CODE_DIR/hooks/session-load.js"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{
          "type": "command",
          "command": "node $CLAUDE_CODE_DIR/hooks/format-check.js"
        }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "node $CLAUDE_CODE_DIR/hooks/pre-commit-guard.js"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "node $CLAUDE_CODE_DIR/hooks/session-save.js"
        }]
      }
    ]
  }
}
EOF
  echo "  ✅ settings.json 作成完了"
fi

# ── 6. CLAUDE.md の存在確認 ───────────────────────────
echo ""
echo "📝 CLAUDE.md を確認します..."

if [ ! -f "$CLAUDE_CODE_DIR/CLAUDE.md" ]; then
  echo "  ⚠️  CLAUDE.md が見つかりません"
  echo "       ~/Desktop/claude-code/CLAUDE.md を作成してください"
else
  echo "  ✅ CLAUDE.md 確認済み"
fi

# ── 7. Node.js バージョン確認 ─────────────────────────
echo ""
echo "🔍 環境を確認します..."

if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v)
  echo "  ✅ Node.js $NODE_VERSION"
else
  echo "  ❌ Node.js が見つかりません"
  echo "       https://nodejs.org からインストールしてください"
fi

if command -v prettier &> /dev/null; then
  echo "  ✅ Prettier $(prettier --version)"
else
  echo "  ⚠️  Prettier がグローバルにインストールされていません"
  echo "       npm install -g prettier でインストールできます"
  echo "       （プロジェクトのローカルインストールでも動作します）"
fi

# ── 8. Tavily APIキーの確認 ───────────────────────────
echo ""
echo "🔑 Tavily APIキーを確認します..."

if [ -z "$TAVILY_API_KEY" ]; then
  echo "  ⚠️  TAVILY_API_KEY が設定されていません"
  echo "       ~/.zshrc に以下を追加してください:"
  echo "       export TAVILY_API_KEY=\"tvly-xxxxxxxxxxxxxxxxxxxx\""
else
  echo "  ✅ TAVILY_API_KEY 設定済み"
fi

# ── 完了 ──────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ セットアップ完了"
echo ""
echo "次のステップ:"
echo "  1. ~/.zshrc に TAVILY_API_KEY を追加（Web検索を使う場合）"
echo "  2. ~/.claude.json の mcpServers に Tavily を追加（README参照）"
echo "  3. claude でClaude Codeを起動して動作確認"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"