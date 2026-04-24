#!/usr/bin/env node
// ~/desktop/claude-code/hooks/bash-guard.js
// タイミング: PreToolUse(Bash) — Bashコマンド実行前
// 役割:
//   1. 危険コマンドの即時ブロック（rm -rf / 等）
//   2. git push --force のブロック（--force-with-lease を促す）
//   3. git commit 前のチェック（シークレットスキャン / Prettier / 型 / テスト）

import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const raw = process.env.HOOK_INPUT ?? "{}";
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
    console.log(`🚫 危険なコマンドをブロックしました: ${label}`);
    console.log(`   コマンド: ${command.slice(0, 120)}`);
    console.log("   意図した操作であれば、ターミナルで直接実行してください。");
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
    console.log("🚫 git push --force はブロックされています。");
    console.log("   共有ブランチの履歴が破壊されるリスクがあります。");
    console.log("");
    console.log("   代替コマンド:");
    console.log("     git push --force-with-lease");
    console.log("   （リモートに他者の変更がある場合は自動でリジェクトされます）");
    process.exit(2);
  }
}

// ═══════════════════════════════════════════════════════
// 3. git commit のガード
// ═══════════════════════════════════════════════════════
if (!command.includes("git commit")) process.exit(0);

console.log("🔍 Pre-commit guard: チェックを開始します...\n");

// プロジェクトルートを取得
let projectRoot;
try {
  projectRoot = execSync("git rev-parse --show-toplevel", { stdio: "pipe" })
    .toString()
    .trim();
} catch {
  console.log("⚠️  Gitリポジトリが見つかりません。スキップします");
  process.exit(0);
}

// ステージングが空なら警告
let stagedFiles = [];
try {
  const staged = execSync("git diff --staged --name-only", { stdio: "pipe" })
    .toString()
    .trim();
  if (!staged) {
    console.log("⚠️  ステージングされたファイルがありません。");
    console.log("   git add でファイルをステージングしてください。");
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
    console.log(`🚫 ${branch} ブランチへの直接コミットは禁止です。`);
    console.log("   フィーチャーブランチを作成してください:");
    console.log("   git checkout -b feat/your-feature-name");
    process.exit(2);
  }
} catch {}

// ── シークレットスキャン ─────────────────────────────
process.stdout.write("  checking Secrets... ");

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
  console.log("❌");
  console.log("\n🚨 シークレットが検出されました。コミットをブロックします:\n");
  for (const { file, label, masked } of secretHits) {
    console.log(`   [${label}] ${masked}...`);
    console.log(`   ファイル: ${file}`);
  }
  console.log("\n   対処方法:");
  console.log("   1. ファイルからシークレットを削除して .env に移動する");
  console.log("   2. .gitignore に .env が含まれているか確認する");
  console.log(
    "   3. 既にコミット済みの場合は git filter-repo でヒストリを書き換える",
  );
  process.exit(2);
} else {
  console.log("✅");
}

// ── ヘルパー ─────────────────────────────────────────
/**
 * @param {string} name
 * @param {string} cmd
 * @param {string[]} args
 * @returns {{ ok: boolean, output: string }}
 */
function runCheck(name, cmd, args) {
  process.stdout.write(`  checking ${name}... `);
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    encoding: "utf-8",
  });
  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();
  const ok = result.status === 0;
  console.log(ok ? "✅" : "❌");
  return { ok, output };
}

function isAvailable(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const failures = [];

// ── Prettier チェック ────────────────────────────────
if (isAvailable("prettier")) {
  const result = runCheck("Prettier", "prettier", ["--check", "."]);
  if (!result.ok) {
    failures.push({
      name: "Prettier",
      output: result.output,
      fix: "prettier --write . で自動修正できます",
    });
  }
}

// ── TypeScript 型チェック ────────────────────────────
const tsconfigPath = join(projectRoot, "tsconfig.json");
if (existsSync(tsconfigPath) && isAvailable("npx")) {
  const result = runCheck("TypeScript", "npx", [
    "tsc",
    "--noEmit",
    "--skipLibCheck",
  ]);
  if (!result.ok) {
    const lines = result.output.split("\n").slice(0, 30).join("\n");
    failures.push({ name: "TypeScript", output: lines, fix: "" });
  }
}

// ── テスト実行 ───────────────────────────────────────
const testRunners = [
  { cmd: "bun", args: ["test", "--passWithNoTests"] },
  { cmd: "npx", args: ["vitest", "run", "--passWithNoTests"] },
  { cmd: "npx", args: ["jest", "--passWithNoTests"] },
];

let testRan = false;
for (const runner of testRunners) {
  if (!isAvailable(runner.cmd)) continue;

  try {
    const pkg = JSON.parse(
      execSync("cat package.json", {
        cwd: projectRoot,
        stdio: "pipe",
      }).toString(),
    );
    const hasTest = pkg.scripts?.test || pkg.scripts?.["test:run"];
    if (!hasTest && runner.cmd === "npx") continue;
  } catch {}

  const result = runCheck("Tests", runner.cmd, runner.args);
  testRan = true;
  if (!result.ok) {
    failures.push({ name: "Tests", output: result.output, fix: "" });
  }
  break;
}

if (!testRan) {
  console.log("  checking Tests... ⏭️  (テストランナーが見つかりません)");
}

// ── 結果出力 ─────────────────────────────────────────
if (failures.length > 0) {
  console.log("\n🚫 コミットをブロックしました。以下を修正してください:\n");
  for (const f of failures) {
    console.log(`${"─".repeat(50)}`);
    console.log(`❌ ${f.name}`);
    if (f.output) console.log(f.output);
    if (f.fix) console.log(`💡 ${f.fix}`);
  }
  console.log(`${"─".repeat(50)}\n`);
  process.exit(2);
}

console.log("\n✅ 全チェック通過。コミットを許可します。");
console.log("💡 次のステップ: /ship でPR descriptionを生成できます。");
