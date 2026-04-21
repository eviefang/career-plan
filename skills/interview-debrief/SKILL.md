---
name: interview-debrief
description: Debrief a real interview from transcript or audio. Triggers on "帮我复盘刚才的面试"、"这是面试录音/转录"、"复盘面试"、"interview debrief". Input is transcript text (preferred — iPhone 语音备忘录自带转录) or a local .m4a path. Outputs 5 fixed blocks: pass-rate, per-question scoring, polished re-answers, gap diagnosis, study plan. Side-effects: appends a "复盘" section to `memory/pipeline/<slug>.md`, appends 2-3 reusable patterns to `memory/patterns.md`.
---

# interview-debrief

这个 skill 解决什么问题：把一场真实面试的转录/录音转成 5 块固定复盘，并把可复用经验沉淀到 `patterns.md`、本次复盘结果写回 `pipeline/<slug>.md`，形成学习闭环。

**区别于 `interview-prep`**：interview-prep 的阶段四是**模拟面试的自评**；本 skill 是**真面的事后复盘**。只写真面。

## 何时触发

- "帮我复盘刚才的面试" / "复盘一下和 XX 的通话" / "这是面试录音/转录"
- "interview debrief" / "review my interview"

## 步骤

### 1. 确定 slug + 读上下文

问用户（或从最近对话推断）：这场面试是哪家公司？拿到 **slug** 后：

- Read `../../memory/pipeline/<slug>.md`：拿"公司尽调"、"JD"、"面试准备"三节作为评判基准。**找不到文件就提醒用户**"没有尽调 / JD 记录，复盘会偏弱，要不要先补一份？"，用户说继续也 OK，但在最终报告里标注"无 pipeline 上下文"。
- Read `../../memory/patterns.md`：尤其"我的反复出现的模式"章节 —— 用于第 4 块"缺口诊断"里对照历史弱项。

### 2. 获取转录

- 用户粘贴文字 → 直接用（iPhone 语音备忘录 iOS 18+ 自带转录，复制即可）
- 用户给 `.m4a` 路径 → 用 Bash `which whisper` 探测本地工具
  - 有：`whisper <path> --model small --language zh --output_format txt`
  - 没有：**不自动安装**。提示："本机没找到 whisper。最快：iPhone 语音备忘录 → 文件 → 转录 → 复制粘给我。非要跑本地：`brew install whisper-cpp` 后再叫我。"

### 3. 生成 5 块主报告

严格按结构，不改顺序：

```markdown
# 面试复盘 · <公司名> · <岗位> · YYYY-MM-DD

## 1. 通过率估计
**估计：<低 / 中 / 高>（<X>%）**

核心信号（3-5 条）：
- <观察 + 具体证据（转录第几分钟对方问了什么）>
- <氛围/节奏变化>
- <反向问题质量>
- <负面信号>

## 2. 逐题打分
每题一行：`✅/⚠️/❌ | 问题摘要 | 差在哪 / 好在哪（一句话）`

## 3. 润色稿
挑 2-4 道 ⚠️ 或 ❌ 的题：
> **Q**: <原题>
> **原答（摘要）**: <一句话>
> **重答**: <150-250 字>
> **关键差异**: <一句话>

## 4. 缺口诊断
从对方问什么反推岗位真实关心什么。按维度排序：
- **<维度 A>**：对方问了 X/Y/Z，真正关心 <能力>。我表现 <强/中/弱>，差距 <具体>。
- **<维度 B>** ...

**对照 patterns.md**：如果和历史模式吻合，明确引用：
> 这和 patterns.md 里"讲项目爱堆技术细节"是同一毛病（第 N 次）。

## 5. 补课清单（按 ROI 排序）
| 优先级 | 要补的 | 怎么补（具体动作） | 预计耗时 |
|---|---|---|---|
| P0 | ... | ... | ... |

- P0: 下次面试前必须补
- P1: 1-2 周内推进
- P2: 知道差距即可
```

### 4. 写入 `pipeline/<slug>.md`

在文件末尾**追加**一节（不改前面的尽调/JD/准备）：

```markdown

## 复盘（YYYY-MM-DD）

- **通过率估计**：<低/中/高>（X%）
- **最值得带走的 2 条**：<一句话>；<一句话>
- **P0 补课**：<列出 P0 项，不用全表>
- _完整 5 块报告见本次主对话_
```

**幂等**：如果同一天的复盘节已存在，追加子节 `### 复盘 v2`，别覆盖前一次。

### 5. 更新 `_index.md` 的"阶段"列

Read `../../memory/pipeline/_index.md`，把该公司行的"阶段"改成：
- 通过率估计高 → "等结果"
- 低 → "已复盘，方向存疑"
- 中 → "已复盘"

### 6. 追加 patterns.md

**独立步骤**，不要混进主报告。提炼 2-3 条**可跨场景复用**的模式：

- ✅ 算："我讲项目又一次把 why 讲成了 what"；"早期 AI 初创最在意能不能从零搭东西"
- ❌ 不算：本次面试的具体内容；一次性判断（"今天面试官心情不好"）

追加前 **Read patterns.md 检查去重**。格式（追加到对应章节**末尾**）：

```markdown

<!-- debrief: <公司> <岗位> YYYY-MM-DD -->
- <模式描述>（出现第 N 次 / 首次观察）
```

追加完**立刻告诉用户**："已追加 N 条 pattern 到 patterns.md：X / Y / Z。" 让用户有机会当场说"这条别留"。

## 原则

- **人在环里**：patterns.md 只追加、不改写。追加完显式汇报给用户。
- **不安慰**：通过率低就说低。用户要准信号，不要情绪价值。
- **证据驱动**：每个判断都要指到转录里的某句话 / JD 里的某条要求。
- **幂等**：同一份转录跑两次，主报告结构一致；pipeline 追加节带日期版本号；patterns 去重。
- **只写 pipeline 和 patterns**。不碰 decisions.md（那是 decision-log 的事）。
