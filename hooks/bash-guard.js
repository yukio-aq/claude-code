#!/usr/bin/env node
// ~/desktop/claude-code/hooks/bash-guard.js
// タイミング: PreToolUse(Bash) — Bashコマンド実行前
// 役割:
//   1. 危険コマンドの即時ブロック（rm -rf / 等）
//   2. git push --force のブロック（--force-with-lease を促す）
//   3. git commit 前のチェック（main 直コミット禁止 / シークレットスキャン）
//   Prettier / 型 / テストは /ship・pr-author が担うためここでは実行しない

import { execSync } from "child_process";
import { readFileSync } from "fs";

// Claude Code passes hook input as JSON on stdin (not via env)
const raw = readFileSync(0, "utf-8") || "{}";
/** @type {{ tool_input?: { command?: string } }} */
const hookInput = JSON.parse(raw);
const command = hookInput.tool_input?.command ?? "";

// ═══════════════════════════════════════════════════════
// 1. 危険コマンドのガード
// ═══════════════════════════════════════════════════════
const DANGEROUS_PATTERNS = [
  {
    // rm -rf / rm -fr のあとにルート・ホーム・ワイルドカードが続くパターン
    pattern: /\brm\s+(-rf|-fr|--recursive\s+--force|--force\s+--recursive)\s+(\/\s*$|\/\*|~\/?(\s|$)|\$HOME)/,
    label: "ルートまたはホームディレクトリの削除",
  },
  {
    pattern: /\brm\s+(-rf|-fr)\s+\$HOME/,
    label: "ホームディレクトリの削除（$HOME）",
  },
  {
    pattern: /\bchmod\s+-R\s+777\s+\//,
    label: "ルートディレクトリの権限変更",
  },
  {
    // dd で物理デバイスに書き込むパターン
    pattern: /\bdd\b.*\bof=\/dev\/[a-z]+\b/,
    label: "物理デバイスへの直接書き込み",
  },
  {
    // fork bomb
    pattern: /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/,
    label: "fork bomb",
  },
];

for (const { pattern, label } of DANGEROUS_PATTERNS) {
  if (pattern.test(command)) {
    console.error(`🚫 危険なコマンドをブロックしました: ${label}`);
    console.error(`   コマンド: ${command.slice(0, 120)}`);
    console.error("   意図した操作であれば、ターミナルで直接実行してください。");
    process.exit(2);
  }
}

// ═══════════════════════════════════════════════════════
// 2. git push --force のガード
// ═══════════════════════════════════════════════════════
if (/\bgit\s+push\b/.test(command)) {
  // --force-with-lease は許可、--force は禁止
  const hasForceWithLease = /--force-with-lease/.test(command);
  const hasForce = /--force(?!-with-lease)/.test(command);

  if (hasForce && !hasForceWithLease) {
    console.error("🚫 git push --force はブロックされています。");
    console.error("   共有ブランチの履歴が破壊されるリスクがあります。");
    console.error("");
    console.error("   代替コマンド:");
    console.error("     git push --force-with-lease");
    console.error("   （リモートに他者の変更がある場合は自動でリジェクトされます）");
    process.exit(2);
  }
}

// ═══════════════════════════════════════════════════════
// 3. git commit のガード
// ═══════════════════════════════════════════════════════
if (!command.includes("git commit")) process.exit(0);

console.error("🔍 Pre-commit guard: チェックを開始します...\n");

// プロジェクトルートを取得
let projectRoot;
try {
  projectRoot = execSync("git rev-parse --show-toplevel", { stdio: "pipe" })
    .toString()
    .trim();
} catch {
  console.error("⚠️  Gitリポジトリが見つかりません。スキップします");
  process.exit(0);
}

// ステージングが空なら警告
let stagedFiles = [];
try {
  const staged = execSync("git diff --staged --name-only", { stdio: "pipe" })
    .toString()
    .trim();
  if (!staged) {
    console.error("⚠️  ステージングされたファイルがありません。");
    console.error("   git add でファイルをステージングしてください。");
    process.exit(2);
  }
  stagedFiles = staged.split("\n").filter(Boolean);
} catch {
  // 初回コミット等でエラーになる場合はスキップ
}

// main ブランチへの直接コミットを防ぐ
try {
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { stdio: "pipe" })
    .toString()
    .trim();
  if (branch === "main" || branch === "master") {
    console.error(`🚫 ${branch} ブランチへの直接コミットは禁止です。`);
    console.error("   フィーチャーブランチを作成してください:");
    console.error("   git checkout -b feat/your-feature-name");
    process.exit(2);
  }
} catch {}

// ── シークレットスキャン ─────────────────────────────
process.stderr.write("  checking Secrets... ");

const SECRET_PATTERNS = [
  { regex: /AKIA[A-Z0-9]{16}/, label: "AWS Access Key ID" },
  { regex: /sk-[a-zA-Z0-9]{20,}/, label: "OpenAI API Key" },
  { regex: /tvly-[a-zA-Z0-9_-]{20,}/, label: "Tavily API Key" },
  { regex: /gh[pso]_[a-zA-Z0-9]{36}/, label: "GitHub Token" },
  { regex: /xox[baprs]-[a-zA-Z0-9-]{10,}/, label: "Slack Token" },
  {
    regex: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/,
    label: "Private Key",
  },
  {
    // 一般的なシークレット変数への代入（値が8文字以上）
    regex:
      /(?:password|passwd|secret|api[_-]?key|access[_-]?token|private[_-]?key)\s*[:=]\s*["']?[a-zA-Z0-9_\-+/]{8,}/i,
    label: "Generic Secret",
  },
];

// バイナリ・大量データファイルはスキャン除外
const SKIP_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "svg",
  "pdf", "zip", "tar", "gz", "rar", "7z",
  "ttf", "woff", "woff2", "eot",
  "mp3", "mp4", "wav", "avi", "mov",
  "exe", "bin", "dll", "so", "dylib",
]);

const secretHits = [];

for (const file of stagedFiles) {
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  if (SKIP_EXTENSIONS.has(ext)) continue;

  // .env ファイル自体はスキャン（誤ってステージングした場合を検出）
  // ただし .env.example は許可（プレースホルダーのみのはず）
  if (file.endsWith(".env.example") || file.endsWith(".env.sample")) continue;

  let content;
  try {
    // ファイル名にスペース等が含まれる場合を考慮して JSON.stringify でエスケープ
    content = execSync(`git show :${JSON.stringify(file)}`, {
      stdio: "pipe",
      maxBuffer: 512 * 1024, // 512KB
    }).toString();
  } catch {
    continue;
  }

  for (const { regex, label } of SECRET_PATTERNS) {
    const match = content.match(regex);
    if (match) {
      const masked = match[0].slice(0, 8) + "****";
      secretHits.push({ file, label, masked });
    }
  }
}

if (secretHits.length > 0) {
  console.error("❌");
  console.error("\n🚨 シークレットが検出されました。コミットをブロックします:\n");
  for (const { file, label, masked } of secretHits) {
    console.error(`   [${label}] ${masked}...`);
    console.error(`   ファイル: ${file}`);
  }
  console.error("\n   対処方法:");
  console.error("   1. ファイルからシークレットを削除して .env に移動する");
  console.error("   2. .gitignore に .env が含まれているか確認する");
  console.error(
    "   3. 既にコミット済みの場合は git filter-repo でヒストリを書き換える",
  );
  process.exit(2);
} else {
  console.error("✅");
}
