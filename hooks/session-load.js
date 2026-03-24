#!/usr/bin/env node
// ~/desktop/claude-code/hooks/session-load.js
// タイミング: UserPromptSubmit（最初のプロンプト送信時）
// 役割: 前回セッションをコンテキストに注入して作業を継続させる

import { readFileSync, existsSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";

// セッション内で1回だけ実行するためのフラグ
// process.ppid = Claude プロセスの PID（セッション中は不変）
const flagFile = join(tmpdir(), `claude-session-loaded-${process.ppid}`);
if (existsSync(flagFile)) process.exit(0);
writeFileSync(flagFile, "");

// ── プロジェクトのセッションファイルを優先、なければスキップ ──
let projectRoot;
try {
  projectRoot = execSync("git rev-parse --show-toplevel", { stdio: "pipe" })
    .toString()
    .trim();
} catch {
  projectRoot = process.env.HOME;
}

const latestSession = join(projectRoot, ".claude", "sessions", "latest.md");

// 前回セッションがなければ静かにスキップ
if (!existsSync(latestSession)) process.exit(0);

// セッションファイルの更新日時を確認
// 24時間以上前のセッションは「古いセッション」として扱う
const mtime = statSync(latestSession).mtimeMs;
const ageHours = (Date.now() - mtime) / 1000 / 60 / 60;

const sessionContent = readFileSync(latestSession, "utf-8");

// 古いセッション（24h超）は警告付きで表示
const ageWarning =
  ageHours > 24
    ? `> ⚠️ このセッションは ${Math.floor(ageHours)} 時間前のものです。\n\n`
    : "";

// stdout に出力した内容は Claude のコンテキストに追加される
console.log(
  `
---
## 📂 前回セッションの引き継ぎ情報
${ageWarning}${sessionContent}
---
上記の情報を踏まえて作業を継続してください。
新しいタスクの場合はこの情報は無視して構いません。
`.trim(),
);
