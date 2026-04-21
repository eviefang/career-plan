---
name: decision-log
description: Mine past Claude Code sessions for job-search decision conversations and append them to plugin's memory/decisions.md. Triggers on "整理一下我最近的求职决策"、"sync decisions"、"同步决策日志"、"/career-plan:sync-decisions". Non-realtime — reads ~/.claude/projects transcripts on demand. Idempotent: tracks processed session IDs in a state file so re-runs only pick up new sessions.
---

# decision-log

这个 skill 解决什么问题：事后挖掘 Claude Code 会话转录，把求职相关的决策对话抽成结构化记录 —— 不靠用户主动填表、不靠实时 hook。借鉴 `session-report` 插件的 script-backed 挖掘模式。

## 何时触发

用户说：
- "整理一下我最近的求职决策" / "同步决策日志" / "更新 decisions"
- "sync decisions" / "update decision log"
- 或者 `/career-plan:sync-decisions`

## 关键路径

- **脚本**：`<skill-dir>/scripts/mine-decisions.mjs`
- **状态文件**：`<plugin-root>/memory/.decision-log-state.json`（记录已处理 session ID）
- **写入目标**：`<plugin-root>/memory/decisions.md`

`<plugin-root>` 是 `career-plan/`；`<skill-dir>` 是 `career-plan/skills/decision-log/`。用绝对路径，别用 `cd`。

## 步骤

### 1. 跑挖掘脚本

```sh
node <skill-dir>/scripts/mine-decisions.mjs \
  --state <plugin-root>/memory/.decision-log-state.json \
  --since 30d \
  > /tmp/career-plan-candidates.json
```

- 默认 `--since 30d`（只扫最近 30 天，快）。用户说"全部重扫"就加 `--all` 跑整库
- 脚本只读、幂等：带 `--state` 时自动跳过已处理的 session
- 输出到 stdout 的 JSON：`{ scanned_sessions, new_sessions, candidates: [...] }`

### 2. 读 candidates

Read `/tmp/career-plan-candidates.json`。每个 candidate：

```
{
  sessionId, cwd, started_at, ended_at, message_count,
  matched_keywords: [...],
  user_snippets: [ "...前 400 字", ... up to 5 ]
}
```

**脚本的匹配是粗筛**（关键词命中）。候选里会有误报 —— 比如某次聊天里提到"面试"但其实是在讨论别的事。**由你来做细筛**。

### 3. 细筛 + 合成条目

对每个 candidate 判断：**这是一次真正的求职决策对话吗？** 判断标准：

- ✅ 算：用户在问"投不投 X"、"怎么准备 X 面试"、"帮我复盘 X"、"X 这家公司怎么样"、"评估一下 X 岗位"
- ❌ 不算：只是顺带提到"面试"这个词（例如在解释某个代码概念时举例）、讨论别人的求职、纯技术 Q&A

对通过细筛的 candidate，合成一条记录，字段固定：

```markdown
### YYYY-MM-DD · <公司名> · <岗位>（如果能识别出来）
- **我问了什么**：<一句话摘要，不超过 40 字>
- **Claude 结论摘要**：<一句话，不超过 60 字。重点是 Claude 给了什么判断 / 建议 / 报告结论>
- **我最终决定**：（留空，等后续对话回填）
- _session: <sessionId 前 8 位>_
```

识别不出公司名/岗位 → 写"未知"。识别不出日期 → 用 `started_at`。

### 4. 追加到 decisions.md

Read 现有 `memory/decisions.md`，在**末尾**追加新条目（按 `started_at` 升序）。**不要改写既有条目**。

追加前再做一次去重：如果同一 session 的记录已经存在（按 session id 后缀判断），跳过。

### 5. 更新状态文件

Write `memory/.decision-log-state.json`：

```json
{
  "processed_session_ids": [...所有已处理 id，包括这次新增的和被细筛淘汰的],
  "last_run": "YYYY-MM-DDTHH:MM:SSZ"
}
```

**淘汰的也要写进 processed_session_ids** —— 否则下次再跑会又一次误报、又要求你细筛一遍。

### 6. 汇报

在主对话里告诉用户：

> 扫描了 N 个 session（最近 30 天），候选 M 个，经细筛追加 K 条到 decisions.md。
> 新增：<列出每条的公司/岗位/日期>。
> 未采纳：<被细筛淘汰的简要原因，可选>。

如果用户质疑某条"这条不该记" —— Read decisions.md，用 Edit 精确删掉那一条，并把该 sessionId 保留在 processed 里（防止下次再次被提议）。

## 原则

- **宁缺毋滥**：不满足细筛条件就不记。brief 原话"宁可漏记不要乱记"。
- **只追加**：decisions.md 末尾 append，不合并、不改写既有条目（"人在环里"）。
- **可追溯**：每条带 session id 后缀，方便用户想 dig 原对话时能回去找。
- **幂等**：状态文件保证重复跑不会产生重复条目。
- **只读挖掘**：脚本永远不写 `~/.claude/projects/` 下的任何东西。

## 不要做

- 不要实时挖掘（不要把这个 skill 挂到 Stop hook 上）—— 实时性不是这个场景的需求。
- 不要替用户填"我最终决定"字段 —— 那是用户后续自己回填的。
- 不要把非求职对话（通用技术 Q&A、日常聊天）强塞进来 "充数"。
