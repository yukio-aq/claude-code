#!/usr/bin/env node
// ~/desktop/claude-code/hooks/session-extract.js
// タイミング: Stop hook（セッション終了時）— session-save.js の後に実行
// 役割: 現在のプロジェクトのセッションから自動でパターンを抽出して instincts/ に保存する
//
// settings.json への登録例:
// {
//   "hooks": {
//     "Stop": [
//       { "matcher": "", "hooks": [{ "type": "command", "command": "node ~/desktop/claude-code/hooks/session-save.js" }] },
//       { "matcher": "", "hooks": [{ "type": "command", "command": "node ~/desktop/claude-code/hooks/session-extract.js" }] }
//     ]
//   }
// }

import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTRACT_SCRIPT = join(__dirname, "../skills/continuous-learning/extract.js");

// extract.js が存在しない場合は静かにスキップ
if (!existsSync(EXTRACT_SCRIPT)) process.exit(0);

// ── プロジェクトルートを取得 ─────────────────────────────
let projectRoot;
try {
  projectRoot = execSync("git rev-parse --show-toplevel", { stdio: "pipe" })
    .toString()
    .trim();
} catch {
  projectRoot = process.env.HOME;
}

// セッションディレクトリがなければスキップ（セッションが一度も保存されていない）
const sessionDir = join(projectRoot, ".claude", "sessions");
if (!existsSync(sessionDir)) {
  console.log("[session-extract] セッションディレクトリが見つかりません。スキップします。");
  process.exit(0);
}

// ── extract.js を実行（非同期・失敗しても終了コードに影響させない）──
console.log("[session-extract] パターン抽出を開始します...");

const result = spawnSync(
  process.execPath, // node 実行パス
  [EXTRACT_SCRIPT, "--dir", projectRoot],
  { encoding: "utf-8", timeout: 15000 }
);

if (result.error) {
  // タイムアウトや実行エラーはスキップ扱い（セッション終了をブロックしない）
  console.log(`[session-extract] スキップ: ${result.error.message}`);
  process.exit(0);
}

if (result.stdout) process.stdout.write(result.stdout);

// 失敗してもセッション終了をブロックしない（exit 0 で通過）
process.exit(0);
