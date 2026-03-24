#!/usr/bin/env node
// skills/continuous-learning/extract.js
// セッションファイルからパターンを抽出して instincts/ に保存する
//
// 使い方:
//   node ~/desktop/claude-code/skills/continuous-learning/extract.js
//   node ~/desktop/claude-code/skills/continuous-learning/extract.js --dir /path/to/project

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTINCTS_DIR = join(__dirname, "instincts");

if (!existsSync(INSTINCTS_DIR)) mkdirSync(INSTINCTS_DIR, { recursive: true });

// ── セッションディレクトリの検索 ──────────────────────────

function getSessionDirs() {
  const dirs = new Set();

  // 引数で --dir が指定されていればそれを使う
  const dirArgIndex = process.argv.indexOf("--dir");
  if (dirArgIndex !== -1 && process.argv[dirArgIndex + 1]) {
    const customSessions = join(process.argv[dirArgIndex + 1], ".claude", "sessions");
    if (existsSync(customSessions)) dirs.add(customSessions);
  }

  // カレントプロジェクトのセッション
  try {
    const projectRoot = execSync("git rev-parse --show-toplevel", {
      stdio: "pipe",
    })
      .toString()
      .trim();
    const projectSessions = join(projectRoot, ".claude", "sessions");
    if (existsSync(projectSessions)) dirs.add(projectSessions);
  } catch {
    // git リポジトリ外でも続行
  }

  // グローバルセッション（ホームディレクトリ）
  const globalSessions = join(process.env.HOME, ".claude", "sessions");
  if (existsSync(globalSessions)) dirs.add(globalSessions);

  return [...dirs];
}

// ── セッションファイルのパース ─────────────────────────────

function parseSection(content, sectionName) {
  const regex = new RegExp(`## ${sectionName}\n([\\s\\S]*?)(?=\n---\n|$)`);
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

function extractItems(text) {
  if (!text || text === "（なし）") return [];
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*\s[\]]*/, "").trim())
    .filter((line) => line.length > 10 && line.length < 200);
}

function loadSessions(sessionDir) {
  if (!existsSync(sessionDir)) return [];

  return readdirSync(sessionDir)
    .filter((f) => f.endsWith(".md") && f !== "latest.md")
    .sort()
    .map((f) => {
      try {
        const content = readFileSync(join(sessionDir, f), "utf-8");
        return {
          sessionId: f.replace(".md", ""),
          decisions: extractItems(parseSection(content, "決定事項")),
          summary: parseSection(content, "作業概要"),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ── カテゴリ判定 ──────────────────────────────────────────

const CATEGORIES = [
  { name: "testing", pattern: /テスト|test|vitest|jest|playwright|カバレッジ/i },
  { name: "api-design", pattern: /API|エンドポイント|endpoint|レスポンス|スキーマ|Zod/i },
  { name: "architecture", pattern: /アーキテクチャ|設計|レイヤー|layer|分割|責務/i },
  { name: "security", pattern: /セキュリティ|認証|認可|auth|token|JWT/i },
  { name: "performance", pattern: /パフォーマンス|最適化|N\+1|キャッシュ|cache|遅い/i },
  { name: "git", pattern: /コミット|commit|ブランチ|branch|PR|マージ/i },
  { name: "ai-agent", pattern: /エージェント|agent|LLM|プロンプト|Mastra|LangChain/i },
];

function categorize(text) {
  for (const { name, pattern } of CATEGORIES) {
    if (pattern.test(text)) return name;
  }
  return "general";
}

// ── instinct ファイルの書き出し ───────────────────────────

function writeInstinctFile(category, items, sessionCount) {
  const date = new Date().toISOString().split("T")[0];
  const filename = join(INSTINCTS_DIR, `${date}-${category}.md`);

  // 既存ファイルがあれば既存アイテムとマージ（重複排除）
  let existingItems = [];
  if (existsSync(filename)) {
    const existing = readFileSync(filename, "utf-8");
    existingItems =
      existing.match(/^- .+/gm)?.map((l) => l.replace(/^- /, "")) ?? [];
  }

  const allItems = [...new Set([...existingItems, ...items])];

  const content = `---
title: ${category} パターン
confidence: 0.7
source_sessions: ${sessionCount}
last_seen: ${date}
---

## パターン

${allItems.map((i) => `- ${i}`).join("\n")}

## 根拠

${sessionCount}件のセッションから自動抽出。
内容を確認して、確かなパターンだけ curated/ に昇格させてください。
`;

  writeFileSync(filename, content, "utf-8");
  return filename;
}

// ── メイン処理 ────────────────────────────────────────────

const sessionDirs = getSessionDirs();

if (sessionDirs.length === 0) {
  console.log("セッションディレクトリが見つかりません。");
  process.exit(0);
}

const allSessions = sessionDirs.flatMap(loadSessions);

if (allSessions.length === 0) {
  console.log("セッションファイルが見つかりません。");
  console.log("検索パス:", sessionDirs.join(", "));
  process.exit(0);
}

console.log(`${allSessions.length}件のセッションを処理中...\n`);

// カテゴリ別に集約
const categoryMap = new Map();

for (const session of allSessions) {
  for (const decision of session.decisions) {
    const category = categorize(decision);
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { items: [], sessionCount: 0 });
    }
    const entry = categoryMap.get(category);
    entry.items.push(decision);
    entry.sessionCount += 1;
  }
}

if (categoryMap.size === 0) {
  console.log(
    "抽出できるパターンがありませんでした（決定事項が空のセッションのみ）。"
  );
  process.exit(0);
}

// ファイル書き出し
const written = [];
for (const [category, { items, sessionCount }] of categoryMap.entries()) {
  const file = writeInstinctFile(category, items, sessionCount);
  written.push(file);
  console.log(`✅ [${category}] ${items.length}件 → ${file}`);
}

console.log(`\n${written.length}件のカテゴリを instincts/ に保存しました。`);
console.log("内容を確認して、確かなパターンだけ curated/ に昇格させてください。");
