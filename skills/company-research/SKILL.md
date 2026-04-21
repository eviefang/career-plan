---
name: company-research
description: Due-diligence a company before applying or interviewing. Triggers on "查一下 XX 公司"、"XX 这家公司怎么样"、"帮我尽调 XX"、"research company X". Input is a company name (Chinese/English/abbrev ok). Outputs a structured DD report AND seeds `memory/pipeline/<slug>.md` so downstream skills (job-fit / interview-prep / debrief) inherit the context. Delegates deep web research to the `researcher` subagent.
---

# company-research

这个 skill 解决什么问题：投简历/面试前，快速把一家公司的基本面、媒体痕迹、红旗看清楚，并把结果落盘到 `memory/pipeline/<slug>.md`，让后续匹配度分析、面试准备、复盘都能复用这份上下文。

## 何时触发

- "查一下 XX 公司" / "XX 这家公司怎么样" / "帮我尽调 XX"
- "research company X" / "what do you know about X"

## 输入

- **必需**：公司名（中/英/简称）
- **可选**：用户手动提供的工商截图 / 官网 URL / JD

## 步骤

### 1. 确认目标 + 定 slug

公司名有歧义（简称、多个同名主体）先问用户"你指的是 A 还是 B？"再开工。确定后立刻定一个 **slug**：
- 全小写，英文/拼音，连字符分隔
- 例：`innuno`、`xiaomi-ai`、`moonshot-ai`
- 这个 slug 是 `memory/pipeline/<slug>.md` 的文件名，也是后续所有 skill 的索引键

### 2. 委派深度研究给 researcher subagent

用 Agent 工具调用 `researcher` subagent，一次性打包所有子问题（prompt 模板见下）。**不要在主对话里直接 WebSearch** —— 原始搜索结果会污染上下文。

```
研究问题：对 <公司名> 做一次投前尽调。用户是求职候选人，即将<投递/面试>。

子问题：
1. 基本面：成立时间、注册资本、实缴、员工规模、股东结构、法人、法人关联企业
2. 业务：主营产品/服务、目标客户、商业模式、最近一轮融资
3. 团队：创始人背景、核心团队规模、公开可查的技术/产品负责人
4. 媒体痕迹：近 1 年媒体报道、公众号/36氪/虎嗅/IT桔子、脉脉/知乎/小红书
5. 红旗：诉讼、裁员传闻、频繁改名、虚挂地址、法人空壳嫌疑

按你定义的结构化简报格式返回。
```

### 3. 工商数据降级

researcher 返回后，如果"基本面"有明显缺口（注册资本/股东/实缴搜不到），**不要瞎猜**。提示用户：

> 公开网络信息不足以覆盖工商基本面。方便的话贴一张天眼查/爱企查截图给我，我读完补进报告。

用户贴了 → 用 Read 读图 → 补进基本面章节。

### 4. 合成主对话报告（5 块）

```markdown
# <公司名> 尽调报告
_生成于 YYYY-MM-DD · 面试/投递场景_

## 1. 基本面
## 2. 业务与团队
## 3. 媒体 & 社群痕迹
## 4. 推断
- **公司所处阶段**
- **商业模式清晰度**
- **红旗** / **绿旗**

## 5. 如果我要和他们通话，建议提问清单
5-8 条，按"对我最重要"排序。
```

末尾加一行覆盖率标注：`⚠️ 本报告覆盖率约 X%（工商/融资/团队/媒体 4 维）`。

### 5. 写入 memory/pipeline/

**新建或覆盖** `../../memory/pipeline/<slug>.md`：

```markdown
# <公司名>

_slug: <slug> · 最近更新: YYYY-MM-DD_

## 公司尽调

（把主对话第 1/2/3/4 块的内容压缩成要点，5 块里的第 5 块"提问清单"也搬进来）

### 基本面
- ...

### 业务与团队
- ...

### 媒体 & 社群
- ...

### 推断
- 阶段：...
- 商业模式清晰度：...
- 红旗：...
- 绿旗：...

### 如果通话要问的
- ...
```

之后的 skill 会在这个文件后面追加 `## JD`、`## 面试准备`、`## 复盘` 子节。

### 6. 更新 `_index.md`

Read `../../memory/pipeline/_index.md`，用 Edit 在表格里**追加或更新**一行：

```
| <公司名> | <岗位，如已知> | 尽调完成 | <slug> | YYYY-MM-DD |
```

如果是新公司 → 追加；如果 slug 已存在 → 更新"阶段"和"最近更新"。

**空占位行** `| _(空)_ | | | | |` 出现的话删掉。

## 原则

- **不编造**。搜不到就说搜不到，报告里留空比瞎填更好。
- **幂等**。同一家公司再跑一次，`pipeline/<slug>.md` 的"公司尽调"节被覆盖（新信息进来是正常的），其他子节（JD/面试准备/复盘）**不动**。
- **demo 友好**。主对话的 5 块报告结构清晰、加粗关键词、可截图。
- **只读挖掘，只写 pipeline 和 _index**。不碰 `patterns.md` 和 `decisions.md`。
