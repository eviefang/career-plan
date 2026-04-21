#!/usr/bin/env node
// Mine ~/.claude/projects/*/*.jsonl for job-search–related sessions.
// Read-only. Emits JSON candidates to stdout. Respects a state file to skip
// already-processed sessions (idempotency).
//
// Usage:
//   node mine-decisions.mjs --state <path-to-state.json> [--since 30d] [--all]
//
// Output shape:
//   {
//     scanned_sessions: N,
//     new_sessions: M,
//     candidates: [
//       {
//         sessionId, cwd, started_at, ended_at, message_count,
//         matched_keywords: [...],
//         user_snippets: [ "first ~200 chars", ... up to 5 ],
//       },
//       ...
//     ]
//   }

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const getArg = (k) => {
  const i = args.indexOf(k);
  return i === -1 ? null : args[i + 1];
};

const STATE_PATH = getArg("--state");
if (!STATE_PATH) {
  console.error("error: --state <path> is required");
  process.exit(2);
}

const SINCE = getArg("--since"); // "7d" / "30d" / null=all
const ALL = args.includes("--all");

// Keywords that signal a job-search decision conversation.
// Keep tight — false positives pollute decisions.md.
const KEYWORDS = [
  // ZH
  "投不投", "投递", "岗位", "面试", "复盘", "尽调", "求职",
  "简历", "招聘", "offer", "薪资", "薪酬", "入职", "跳槽",
  "JD", "职位",
  // EN
  "interview", "hiring", "job offer", "resume", "apply to",
  "should I apply", "company research",
];

const PROJECTS_DIR = join(homedir(), ".claude", "projects");

function loadState() {
  if (!existsSync(STATE_PATH)) {
    return { processed_session_ids: [], last_run: null };
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf8"));
}

function parseSince(spec) {
  if (!spec) return null;
  const m = spec.match(/^(\d+)([dh])$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const ms = m[2] === "d" ? n * 86400_000 : n * 3600_000;
  return Date.now() - ms;
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

function scanSession(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  const lines = raw.split("\n").filter(Boolean);
  if (lines.length === 0) return null;

  let sessionId = null;
  let cwd = null;
  let startedAt = null;
  let endedAt = null;
  let messageCount = 0;
  const userTexts = [];
  const matched = new Set();

  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.sessionId && !sessionId) sessionId = obj.sessionId;
    if (obj.cwd && !cwd) cwd = obj.cwd;
    if (obj.timestamp) {
      const t = Date.parse(obj.timestamp);
      if (!Number.isNaN(t)) {
        if (startedAt === null || t < startedAt) startedAt = t;
        if (endedAt === null || t > endedAt) endedAt = t;
      }
    }
    if (obj.type === "user" && obj.message?.role === "user") {
      messageCount++;
      const text = extractText(obj.message.content);
      if (!text) continue;
      // Skip harness-injected user messages (interrupts, tool results, reminders)
      if (text.startsWith("[Request interrupted") || text.startsWith("<tool_use_error>")) continue;
      userTexts.push({ text, ts: obj.timestamp });
      const lower = text.toLowerCase();
      for (const kw of KEYWORDS) {
        if (lower.includes(kw.toLowerCase())) matched.add(kw);
      }
    }
  }

  if (!sessionId || matched.size === 0) return null;

  // Pick up to 5 snippets: prefer the ones that matched keywords.
  const matchedLower = [...matched].map((k) => k.toLowerCase());
  const scored = userTexts.map((m) => {
    const lower = m.text.toLowerCase();
    const hits = matchedLower.filter((k) => lower.includes(k)).length;
    return { ...m, hits };
  });
  scored.sort((a, b) => b.hits - a.hits || a.ts.localeCompare(b.ts));
  const snippets = scored.slice(0, 5).map((m) => m.text.slice(0, 400));

  return {
    sessionId,
    cwd,
    started_at: startedAt ? new Date(startedAt).toISOString() : null,
    ended_at: endedAt ? new Date(endedAt).toISOString() : null,
    message_count: messageCount,
    matched_keywords: [...matched],
    user_snippets: snippets,
  };
}

function main() {
  const state = loadState();
  const processed = new Set(state.processed_session_ids);
  const sinceMs = parseSince(SINCE);

  if (!existsSync(PROJECTS_DIR)) {
    console.error(`error: ${PROJECTS_DIR} not found`);
    process.exit(1);
  }

  const projectDirs = readdirSync(PROJECTS_DIR).map((d) => join(PROJECTS_DIR, d));
  const candidates = [];
  let scanned = 0;

  for (const dir of projectDirs) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (!f.endsWith(".jsonl")) continue;
      const fp = join(dir, f);
      let mtime;
      try {
        mtime = statSync(fp).mtimeMs;
      } catch {
        continue;
      }
      if (sinceMs && mtime < sinceMs) continue;

      const sid = f.replace(/\.jsonl$/, "");
      if (!ALL && processed.has(sid)) continue;

      scanned++;
      const result = scanSession(fp);
      if (result) candidates.push(result);
    }
  }

  candidates.sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""));

  process.stdout.write(
    JSON.stringify({ scanned_sessions: scanned, new_sessions: candidates.length, candidates }, null, 2)
  );
}

main();
