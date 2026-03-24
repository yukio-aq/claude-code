#!/usr/bin/env node
// ~/desktop/claude-code/hooks/pre-commit-guard.js
// タイミング: PreToolUse(Bash) — Bashコマンド実行前
// 役割: git commit を検知したときだけ発火してコミットをガード

import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

// ── git commit 以外はスルー ──────────────────────────
const raw = process.env.HOOK_INPUT ?? "{}";
/** @type {{ tool_input?: { command?: string } }} */
const hookInput = JSON.parse(raw);
const command = hookInput.tool_input?.command ?? "";

if (!command.includes("git commit")) process.exit(0);

console.log("🔍 Pre-commit guard: チェックを開始します...\n");

// ── プロジェクトルートを取得 ─────────────────────────
let projectRoot;
try {
  projectRoot = execSync("git rev-parse --show-toplevel", { stdio: "pipe" })
    .toString()
    .trim();
} catch {
  console.log("⚠️  Gitリポジトリが見つかりません。スキップします");
  process.exit(0);
}

// ── ステージングが空なら警告 ─────────────────────────
try {
  const staged = execSync("git diff --staged --name-only", { stdio: "pipe" })
    .toString()
    .trim();
  if (!staged) {
    console.log("⚠️  ステージングされたファイルがありません。");
    console.log("   git add でファイルをステージングしてください。");
    process.exit(2);
  }
} catch {
  // 初回コミット等でエラーになる場合はスキップ
}

// ── main ブランチへの直接 push を防ぐ ────────────────
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

// ── ヘルパー: コマンド実行 ───────────────────────────
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

/** コマンドが使えるか確認 */
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
    // エラーが多い場合は先頭30行に絞る
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

  // package.json に test スクリプトがあるか確認
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
  // exit 2 → コミットをブロック + Claudeがエラーを受け取って自動修正を試みる
  process.exit(2);
}

console.log("\n✅ 全チェック通過。コミットを許可します。");
console.log("💡 次のステップ: /ship でPR descriptionを生成できます。");
