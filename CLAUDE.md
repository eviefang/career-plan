# career-plan 插件约定

求职工作流插件。5 个 skill 通过 `memory/` 共享上下文，形成"尽调 → 匹配 → 准备 → 复盘 → 沉淀"的学习闭环。

## Memory 文件

```
memory/
├── pipeline/
│   ├── _index.md              # 活跃 pipeline 一览表
│   ├── <公司-slug>.md         # 一家一文件：尽调 / JD / 面试准备 / 复盘
│   └── archive/               # 已结束的公司手动挪进来（不自动 GC）
├── patterns.md                # 反复出现的模式 / 公司类型×关注点 / 面试官×有效答法
├── decisions.md               # 决策日志（由 decision-log 挖掘填充）
└── .decision-log-state.json   # 挖掘脚本的已处理 session id
```

**公司 slug 约定**：全小写、英文/拼音、连字符分隔，例如 `innuno.md`、`xiaomi-ai.md`。company-research 首次创建文件时定 slug 并写入 `_index.md`，后续 skill 都按这个 slug 找。

## 跨 skill 读写约定

| Skill | 读 | 写 |
|---|---|---|
| `company-research` | — | `pipeline/<slug>.md`（新建或覆盖"公司尽调"子节）+ `_index.md`（新增/更新一行） |
| `job-fit-analyzer` | `pipeline/<slug>.md`（辅助信号，不改变场景判断）· `patterns.md`（辅助打分） | `pipeline/<slug>.md`（追加"JD"子节）· `_index.md`（更新"阶段"列） |
| `interview-prep` | `pipeline/<slug>.md`（全节）· `patterns.md`（弱项定向出题） | `pipeline/<slug>.md`（追加"面试准备"子节） |
| `interview-debrief` | `pipeline/<slug>.md`（全节）· `patterns.md` | `pipeline/<slug>.md`（追加"复盘"子节）· `patterns.md`（追加 2-3 条）· `_index.md`（更新"阶段"列） |
| `decision-log` | `~/.claude/projects/*.jsonl`（挖掘） | `decisions.md` · `.decision-log-state.json` |

## 原则

1. **写 memory 一律追加**，不改既有条目。patterns.md 和 decisions.md 由用户决定是否删改。
2. **读 memory 是辅助上下文**，不要因此跳过 skill 自身对用户的对话（确认简历版本、场景判断、询问准备时间等）。
3. **文件不存在就不写**。`pipeline/<slug>.md` 不存在说明还没跑尽调 —— 尊重用户节奏，不自动新建。唯一可新建文件的是 `company-research`。
4. **路径用相对**：skill 访问 memory 一律 `../../memory/xxx`。
5. **不写 decisions.md**（除 `decision-log`）。决策日志是挖掘而非实时追加 —— 把"记录"和"答问"解耦。
6. **归档显式触发**：用户说"X 凉了"/"拿到 Y 的 offer" → skill 把 `pipeline/<slug>.md` 移到 `archive/` 并从 `_index.md` 删行。不自动 GC。

## 快速流程图

```
"查一下 innuno"        → company-research  → 新建 pipeline/innuno.md
"这个 JD 值不值得投"    → job-fit-analyzer  → 追加 JD 子节
"准备 innuno 的面试"    → interview-prep    → 追加面试准备子节
"复盘刚才和 innuno 的"  → interview-debrief → 追加复盘 + 沉淀 patterns
"整理求职决策"          → decision-log      → 挖掘转录写 decisions.md
```
