#!/usr/bin/env node
// ~/desktop/claude-code/hooks/format-check.js
// タイミング: PostToolUse（Write / Edit / MultiEdit 後）
// 役割: 保存されたファイルに即時フォーマット・型チェックを実行

import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";

// ── 対象ファイルを取得 ───────────────────────────────────
const raw = process.env.HOOK_INPUT ?? "{}";
/** @type {{ tool_input?: { file_path?: string } }} */
const hookInput = JSON.parse(raw);

const filePath = hookInput.tool_input?.file_path;
if (!filePath || !existsSync(filePath)) process.exit(0);

const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

// ── 対象外の拡張子はスキップ ────────────────────────────
const supported = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "json",
  "css",
  "md",
]);
if (!supported.has(ext)) process.exit(0);

// ── プロジェクトルートを取得 ─────────────────────────────
let projectRoot;
try {
  projectRoot = execSync("git rev-parse --show-toplevel", { stdio: "pipe" })
    .toString()
    .trim();
} catch {
  projectRoot = dirname(filePath);
}

// ── ヘルパー ─────────────────────────────────────────────
/**
 * @param {string} cmd
 * @param {string[]} args
 * @returns {{ ok: boolean, output: string }}
 */
function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: projectRoot, encoding: "utf-8" });
  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();
  return { ok: result.status === 0, output };
}

function isInstalled(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const errors = [];

// ── TypeScript / JavaScript ───────────────────────────────
if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) {
  // Prettier フォーマット（自動修正）
  if (isInstalled("prettier")) {
    const fmt = run("prettier", ["--write", filePath]);
    if (!fmt.ok) errors.push(`Prettier エラー:\n${fmt.output}`);
  }

  // 型チェック（tsconfig.json があるときのみ）
  const tsconfigPath = join(projectRoot, "tsconfig.json");
  if (["ts", "tsx"].includes(ext) && existsSync(tsconfigPath)) {
    const tsc = run("npx", ["tsc", "--noEmit", "--skipLibCheck"]);
    if (!tsc.ok) {
      const lines = tsc.output.split("\n");
      const relevant = lines
        .filter((l) => l.includes(filePath) || l.includes("error TS"))
        .slice(0, 20)
        .join("\n");
      if (relevant) errors.push(`TypeScript エラー:\n${relevant}`);
    }
  }
}

// ── Python ───────────────────────────────────────────────
if (ext === "py") {
  if (isInstalled("ruff")) {
    run("ruff", ["check", "--fix", filePath]);
    run("ruff", ["format", filePath]);
  }
}

// ── JSON / CSS ───────────────────────────────────────────
if (["json", "css"].includes(ext)) {
  if (isInstalled("prettier")) {
    const fmt = run("prettier", ["--write", filePath]);
    if (!fmt.ok) errors.push(`Prettier エラー:\n${fmt.output}`);
  }
}

// ── 結果出力 ─────────────────────────────────────────────
if (errors.length > 0) {
  // stdout に出力 → Claude がエラーを受け取って自動修正を試みる
  console.log(
    [
      `⚠️ ${filePath} のチェックで問題が見つかりました:`,
      "",
      ...errors,
      "",
      "上記の問題を修正してください。",
    ].join("\n"),
  );
  process.exit(1); // 警告として返す（処理はブロックしない）
}

process.exit(0);
