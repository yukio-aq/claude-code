#!/usr/bin/env node
// ~/desktop/claude-code/hooks/session-save.js
// 呼び出し元: /save コマンド（手動実行）
// 役割: 会話の要約・決定事項・デバッグログをMarkdownで保存

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, unlinkSync, symlinkSync, statSync } from "fs";
import { join } from "path";

// ── 引数取得（/save <メモ> で渡された場合）──────────────
const memo = process.argv[2] ?? "";

// ── 入力取得 ────────────────────────────────────────────
const raw = process.env.HOOK_INPUT ?? "{}";
/** @type {{ transcript?: Array<{role: string, content: any}> }} */
const hookInput = JSON.parse(raw);
const transcript = hookInput.transcript ?? [];

// HOOK_INPUTが空の場合（/saveコマンド経由）はトランスクリプトなしで保存
const isManualSave = transcript.length === 0;

// ── 保存先の決定（プロジェクト単位で分離）───────────────
let projectRoot;
try {
  projectRoot = execSync("git rev-parse --show-toplevel", { stdio: "pipe" })
    .toString()
    .trim();
} catch {
  projectRoot = process.env.HOME;
}

const sessionDir = join(projectRoot, ".claude", "sessions");
if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });

const sessionId = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .slice(0, 19);
const sessionFile = join(sessionDir, `${sessionId}.md`);

// ── メッセージをテキストに変換 ───────────────────────────
/** @param {any} content */
function toText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

const messages = transcript.map((m) => ({
  role: m.role,
  text: toText(m.content),
}));

const assistantMessages = messages.filter((m) => m.role === "assistant");
const userMessages = messages.filter((m) => m.role === "user");

// ── 抽出ロジック ─────────────────────────────────────────

/** 会話の要約: 最後のアシスタント応答の冒頭300文字 */
function extractSummary() {
  const last = [...assistantMessages].pop();
  if (!last) return "（なし）";
  const trimmed = last.text.slice(0, 300).trim();
  return trimmed + (last.text.length > 300 ? "…" : "");
}

/** 決定事項: 「〜にする」「採用」「決定」を含む一文を抽出 */
function extractDecisions() {
  const pattern = /[^。\n]*(?:にする|採用|決定|選択|使う|ことにした)[^。\n]*/g;
  const found = new Set();
  for (const m of assistantMessages) {
    for (const match of m.text.matchAll(pattern)) {
      const line = match[0].trim();
      if (line.length > 10 && line.length < 120) found.add(line);
    }
  }
  return found.size ? [...found].map((d) => `- ${d}`).join("\n") : "（なし）";
}

/** デバッグログ・エラー解決過程 */
function extractDebugLog() {
  const entries = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const isErrorMsg =
      /error|エラー|failed|失敗|exception|cannot|undefined|null/i.test(m.text);
    if (!isErrorMsg) continue;

    const errorSnippet = m.text.slice(0, 200).trim();
    const next = messages[i + 1];
    const resolution =
      next?.role === "assistant" ? next.text.slice(0, 300).trim() : null;

    if (errorSnippet) {
      entries.push(
        [
          `### エラー (${m.role})`,
          "```",
          errorSnippet,
          "```",
          resolution ? `**解決過程:**\n${resolution}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  }
  return entries.length ? entries.join("\n\n---\n\n") : "（なし）";
}

/** 次回の開始ポイント */
function extractNextStep() {
  const pattern = /[^。\n]*(?:次は|次に|TODO|あとで|残り|未完了)[^。\n]*/gi;
  const found = new Set();
  for (const m of assistantMessages) {
    for (const match of m.text.matchAll(pattern)) {
      const line = match[0].trim();
      if (line.length > 5 && line.length < 120) found.add(line);
    }
  }
  for (const m of messages) {
    for (const match of m.text.matchAll(/[-*]\s*\[ \]\s*(.+)/g)) {
      found.add(`[ ] ${match[1].trim()}`);
    }
  }
  // /save <メモ> で渡された内容を先頭に追加
  if (memo) found.add(memo);
  return found.size ? [...found].map((s) => `- ${s}`).join("\n") : "（なし）";
}

// ── Markdown生成 ─────────────────────────────────────────
const content = `# Session: ${sessionId}

> 保存日時: ${new Date().toLocaleString("ja-JP")}
> メッセージ数: ユーザー ${userMessages.length}件 / Claude ${assistantMessages.length}件
${memo ? `> メモ: ${memo}` : ""}

---

## 作業概要
${isManualSave ? "（/save コマンドで手動保存）" : extractSummary()}

---

## 決定事項
${isManualSave ? "（なし）" : extractDecisions()}

---

## デバッグログ・エラー解決過程
${isManualSave ? "（なし）" : extractDebugLog()}

---

## 次回の開始ポイント
${extractNextStep()}
`;

writeFileSync(sessionFile, content, "utf-8");

// latest.md を常に最新に更新
const latestLink = join(sessionDir, "latest.md");
try { unlinkSync(latestLink); } catch (_) {}
symlinkSync(sessionFile, latestLink);

console.log(`✅ Session saved → ${sessionFile}`);