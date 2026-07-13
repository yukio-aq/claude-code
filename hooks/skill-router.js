#!/usr/bin/env node
// ~/desktop/claude-code/hooks/skill-router.js
// タイミング: UserPromptSubmit
// 役割: プロンプトからタスクタイプを推定し、関連スキルのサマリーを注入する

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── manifest.yaml パーサー ───────────────────────────────────
// "- name: xxx\n  key: val\n  key: [a,b]" 形式のフラットリストを読む
function parseManifest(content) {
  const agents = [];
  let current = null;
  for (const line of content.split("\n")) {
    if (line.startsWith("- name:")) {
      if (current) agents.push(current);
      current = { name: line.slice("- name:".length).trim() };
    } else if (current && /^  \w/.test(line) && line.includes(":")) {
      const colonIdx = line.indexOf(":");
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (value.startsWith("[") && value.endsWith("]")) {
        current[key] = value.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean);
      } else if (value) {
        current[key] = value;
      }
    }
  }
  if (current) agents.push(current);
  return agents;
}

// ── アクション推論 ───────────────────────────────────────────
function inferAction(prompt) {
  if (/レビュー|確認して|チェック|見てほしい|見てください/.test(prompt)) return "review";
  if (/テストを|テストが|テスト実装|spec|カバレッジ/.test(prompt)) return "test";
  if (/設計して|アーキテクチャ|計画して|ADR|方針を/.test(prompt)) return "design";
  if (/監視|SLO|メトリクス|トレーシング|ログ設計/.test(prompt)) return "ops";
  return "implement";
}

const raw = process.env.HOOK_INPUT ?? "{}";
const hookInput = JSON.parse(raw);
const prompt = hookInput.prompt ?? "";

if (!prompt.trim()) process.exit(0);

// スキルディレクトリを特定（このスクリプトの ../skills/）
const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(scriptDir, "..", "skills");

if (!existsSync(skillsDir)) process.exit(0);

// ── SKILL.md frontmatterパーサー ────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fm = {};
  const lines = match[1].split("\n");
  let currentKey = null;
  let currentList = [];

  for (const line of lines) {
    if (line.startsWith("  - ")) {
      currentList.push(line.slice(4).trim());
    } else if (line.startsWith("  ") && line.includes(":")) {
      // ネストされたキー（例: "  related: [a, b]"）
      const colonIdx = line.indexOf(":");
      const nestedKey = line.slice(0, colonIdx).trim();
      const nestedValue = line.slice(colonIdx + 1).trim();
      if (nestedValue.startsWith("[") && nestedValue.endsWith("]")) {
        const items = nestedValue.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean);
        if (currentKey) fm[`${currentKey}.${nestedKey}`] = items;
      }
    } else if (/^\w/.test(line) && line.includes(":")) {
      if (currentKey && currentList.length > 0) {
        fm[currentKey] = currentList;
        currentList = [];
      }
      const colonIdx = line.indexOf(":");
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      currentKey = key;
      if (value) {
        fm[key] = value;
        currentKey = null;
      } else {
        currentList = [];
      }
    }
  }
  if (currentKey && currentList.length > 0) {
    fm[currentKey] = currentList;
  }

  return fm;
}

// ── スコアリング ────────────────────────────────────────────
// 2段階マッチング:
//   1. N-gram（5〜10文字）: when_to_use の長い技術用語を照合
//   2. keywords（2文字以上）: 自然な会話語彙を照合（複数ヒットで加算）

function scoreNgram(skillText, prompt) {
  let score = 0;
  let i = 0;
  while (i < prompt.length) {
    let matched = false;
    for (let len = 10; len >= 5; len--) {
      if (i + len > prompt.length) continue;
      const sub = prompt.slice(i, i + len);
      if (skillText.includes(sub)) {
        score += len / 6;
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }
  return score;
}

function scoreKeywords(keywords, prompt) {
  if (!Array.isArray(keywords)) return 0;
  let score = 0;
  for (const kw of keywords) {
    if (!kw || kw.length < 2) continue;
    let pos = 0;
    let hits = 0;
    while ((pos = prompt.indexOf(kw, pos)) !== -1) {
      hits++;
      pos += kw.length;
    }
    if (hits > 0) {
      // 初回ヒット 1.0、追加ヒットごと +0.4
      score += 1.0 + (hits - 1) * 0.4;
    }
  }
  return score;
}

function scoreSkill(fm, prompt) {
  const whenToUse = fm.when_to_use;
  if (!Array.isArray(whenToUse)) return 0;

  const skillText = whenToUse.join(" ");
  return scoreNgram(skillText, prompt) + scoreKeywords(fm.keywords, prompt);
}

// ── 全スキルをスキャン ───────────────────────────────────────
const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

const scored = [];

for (const skillName of skillDirs) {
  const skillFile = join(skillsDir, skillName, "SKILL.md");
  if (!existsSync(skillFile)) continue;

  let content;
  try {
    content = readFileSync(skillFile, "utf-8");
  } catch {
    continue;
  }

  const fm = parseFrontmatter(content);
  if (!fm || !Array.isArray(fm.when_to_use)) continue;

  const score = scoreSkill(fm, prompt);
  if (score > 0) {
    scored.push({
      name: fm.name || skillName,
      description: fm.description || "",
      when_to_use: fm.when_to_use,
      related: fm["links.related"] || [],
      score,
    });
  }
}

// 上位3件（スコアが低すぎるものは除外）
const MIN_SCORE = 1.0;
const top = scored
  .filter(s => s.score >= MIN_SCORE)
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);

if (top.length === 0) process.exit(0);

// ── エージェントサジェスト ────────────────────────────────────
const manifestFile = join(scriptDir, "..", "agents", "manifest.yaml");
let suggestedAgents = [];

if (existsSync(manifestFile)) {
  try {
    const manifestContent = readFileSync(manifestFile, "utf-8");
    const allAgents = parseManifest(manifestContent);
    const action = inferAction(prompt);
    const detectedSkillNames = new Set(top.map(s => s.name));

    suggestedAgents = allAgents
      .filter(agent => {
        if (!Array.isArray(agent.skills) || agent.skills.length === 0) return false;
        const actionMatch = agent.action === action;
        const skillMatch = agent.skills.some(s => detectedSkillNames.has(s));
        return actionMatch && skillMatch;
      })
      .slice(0, 2);
  } catch {
    // manifest が読めなくてもスキル提示は続行
  }
}

// ── サマリーを出力 ───────────────────────────────────────────
const lines = [
  "",
  "---",
  "## 🔍 関連スキル（自動検出）",
  "",
];

const detectedNames = new Set(top.map(s => s.name));

for (const skill of top) {
  const shortDesc = skill.description.split("。")[0];
  lines.push(`- **${skill.name}**: ${shortDesc}`);
  for (const u of skill.when_to_use.slice(0, 2)) {
    lines.push(`  → ${u}`);
  }
  // 検出済みスキルと重複しない関連スキルのみ表示
  const relatedToShow = skill.related.filter(r => !detectedNames.has(r));
  if (relatedToShow.length > 0) {
    lines.push(`  🔗 関連: ${relatedToShow.join(", ")}`);
  }
  lines.push("");
}

if (suggestedAgents.length > 0) {
  lines.push("推奨エージェント:");
  for (const agent of suggestedAgents) {
    lines.push(`- **${agent.name}**: ${agent.description}`);
  }
  lines.push("");
}

lines.push("必要に応じて Skill ツールでフルロードしてください。");
lines.push("---");

console.log(lines.join("\n"));
