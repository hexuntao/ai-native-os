# Web UI 草图设计 V2

基于以下约束与参考重绘：

- `Challenge.md`
- `docs/architecture.md`
- `docs/api-conventions.md`
- `docs/rbac-design.md`
- `docs/ai-agent-design.md`
- 当前实现：`apps/web/src/components/shell/dashboard-shell.tsx`
- 当前实现：`apps/web/src/components/copilot/copilot-panel.tsx`

参考产品方向：

- LangSmith：Trace / Eval / Prompt / Compare
- Braintrust：Logs / Playground / Prompt / Dataset / Scorer
- Dust / Glean：Agent Builder / Workspace / Knowledge / Permission
- CopilotKit / OpenAI Playground：Generative UI / Prompt iteration

## 1. 重绘目标

上一版的问题不在“页面不够多”，而在信息架构仍然是传统后台范式：

- 以“系统管理”而不是“AI 运行对象”作为主轴
- AI 面板还是附属组件，不是操作中枢
- 缺少 `Run / Trace / Eval / Approval / Prompt` 这些 AI-native 一等对象
- 缺少从“运行异常”回跳到“配置与治理”的闭环

V2 目标：

- 首页不是欢迎页，而是 `AI Operations Center`
- 一级导航以 AI 生命周期组织，而不是按旧式菜单树组织
- 每个核心页都支持“观测 -> 调试 -> 调整 -> 审批 -> 发布”
- Copilot 不再只是聊天框，而是上下文工作台

## 2. 新的信息架构

```text
AI Native OS
├─ Home
│  └─ AI Operations Center
├─ Build
│  ├─ Agents
│  ├─ Workflows
│  ├─ Prompts
│  └─ Tools
├─ Observe
│  ├─ Runs
│  ├─ Traces
│  ├─ Monitor
│  └─ Cost & Usage
├─ Improve
│  ├─ Evals
│  ├─ Datasets
│  ├─ Feedback
│  └─ Experiments
├─ Knowledge
│  ├─ Sources
│  ├─ Collections
│  ├─ Retrieval Quality
│  └─ Sync Jobs
├─ Govern
│  ├─ Audit
│  ├─ Approvals
│  ├─ Policies
│  └─ Prompt Releases
├─ Workspace
│  ├─ Inbox
│  ├─ Tasks
│  ├─ Reports
│  └─ Sessions
└─ Admin
   ├─ Users
   ├─ Roles
   ├─ Permissions
   ├─ Menus
   └─ Config
```

### 架构说明

- `Build` 负责定义 AI 能力。
- `Observe` 负责查看运行态。
- `Improve` 负责质量迭代。
- `Knowledge` 负责上下文工程。
- `Govern` 负责权限、审计、审批、发布门禁。
- `Workspace` 负责人机协作待办。
- `Admin` 退居最后，不再占据产品心智中心。

这才符合文档中的五层 AI Native 架构，而不是传统后台菜单翻新。

## 3. 全局壳层 V2

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ GLOBAL COMMAND BAR                                                                                │
│ [Search agents, traces, prompts, runs...]      [env: prod] [project] [role] [notifications]      │
├───────────────────────┬─────────────────────────────────────────────────────────────┬──────────────┤
│ LEFT NAV              │ MAIN CANVAS                                                 │ RIGHT RAIL   │
│                       │                                                             │              │
│ AI Native OS          │ Page Header                                                  │ Copilot      │
│ Workspace switcher    │ title / status / breadcrumb / quick actions                  │              │
│                       │                                                             │ Context Pack │
│ Home                  │ Main work surface                                            │ - current obj│
│ Build                 │ - list / graph / timeline / compare / editor                 │ - permissions│
│ Observe               │ - page owns the central task                                 │ - recent runs│
│ Improve               │                                                             │              │
│ Knowledge             │                                                             │ Suggested Ops│
│ Govern                │                                                             │ - compare    │
│ Workspace             │                                                             │ - explain    │
│ Admin                 │                                                             │ - draft fix  │
│                       │                                                             │              │
│ Pinned views          │                                                             │ Conversation │
│ Recent objects        │                                                             │ Tool actions │
└───────────────────────┴─────────────────────────────────────────────────────────────┴──────────────┘
```

### 壳层原则

- 顶部必须有全局对象检索，不只是页面切换。
- 左侧导航按 AI 生命周期分组，而不是按传统部门分组。
- 右侧不是“Chat”而是“Contextual Copilot Rail”。
- Copilot Rail 需要读取当前页面对象，支持 explain、compare、draft、diagnose、prepare approval。

## 4. 首页：AI Operations Center

首页应该像“飞行控制台”，不是 KPI 拼贴墙。

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ AI Operations Center                                                          [New Agent] │
│ 当前系统的运行质量、风险、待办与发布状态                                                │
├──────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┤
│ Active Agents        │ Degraded Runs        │ Eval Regressions     │ Pending Approvals    │
│ 12                   │ 3                    │ 2                    │ 5                    │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ Live System Map                                                                          │
│ Agent A ──uses──> Tool X ──reads──> KB Policies                                          │
│        └─triggered──> Workflow R                                                         │
│ Agent B ──failed──> Prompt v14                                                           │
├───────────────────────────────────────────────┬────────────────────────────────────────────┤
│ Attention Queue                               │ Release Pipeline                           │
│ - agent degraded                              │ Prompt draft -> Eval -> Approval -> Deploy │
│ - retrieval drift                             │ Agent config -> Test -> Review -> Enable   │
│ - prompt regression                           │ Knowledge sync -> Reindex -> Verify        │
├───────────────────────────────────────────────┴────────────────────────────────────────────┤
│ Recent High-Impact Events                                                                  │
│ [09:22] eval regression on admin-copilot                                                 │
│ [09:11] approval requested for prompt release v15                                         │
│ [08:58] knowledge sync failed on HR policy space                                          │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 首页关键点

- 不是“指标展示”，而是“需要采取行动的系统状态”。
- 中间必须有关系图或依赖图，体现 Agent、Tool、Knowledge、Workflow 的连接。
- 下方要有发布门禁链路，让人知道变更如何走向生产。

## 5. Agents 页面

Agent 页面不该只是表格，要像“能力目录 + 配置台 +运行快照”。

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Agents                                                               [Create] [Import]    │
├──────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ LEFT: Agent Catalog          │ RIGHT: Agent Studio                                         │
│ - admin-copilot              │ Agent: admin-copilot                                        │
│ - audit-analyst              │ Status: active                                              │
│ - report-schedule            │                                                             │
│                              │ Tabs: [Overview] [Instructions] [Tools] [Memory] [Access]  │
│ Filters                      │                                                             │
│ [active] [planned] [degraded]│ Overview                                                    │
│ [with approvals]             │ - purpose                                                   │
│ [with kb]                    │ - owning team                                               │
│                              │ - last release                                              │
│                              │                                                             │
│                              │ Dependency Graph                                            │
│                              │ Agent -> Tools -> Knowledge -> Workflows                    │
│                              │                                                             │
│                              │ Runtime summary                                             │
│                              │ success rate / avg latency / last failures                  │
│                              │                                                             │
│                              │ [Open runs] [Run test] [Draft change] [Request approval]    │
└──────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### 设计重点

- Agent 详情必须包含依赖图，不是只有字段配置。
- `planned` 和 `active` 必须明确分层展示，避免蓝图和运行时混淆。
- 任何变更都应走 `Draft change -> Eval -> Approval -> Release`。

## 6. Runs / Traces 页面

这是 AI-native 后台最关键的页面，应该成为调试中心。

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Runs & Traces                                                  [Compare] [Add to dataset]  │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ Filters: agent / workflow / tool / user / status / model / prompt version / date         │
├──────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ RUN TABLE                    │ TRACE INSPECTOR                                              │
│ time     actor   target      │ Run #run_10231                                              │
│ 09:11    admin   agent A     │ Status: degraded                                             │
│ 09:09    cron    wf report   │                                                             │
│ 09:03    user42  copilot     │ Step Timeline                                               │
│                              │ 1. prompt resolved v14                                       │
│ row selected                 │ 2. tool_user_directory called                               │
│                              │ 3. permission checked                                        │
│                              │ 4. retrieval miss                                            │
│                              │ 5. fallback response                                         │
│                              │                                                             │
│                              │ Inputs / Outputs / Retrieved docs / Tool calls / Metadata   │
│                              │                                                             │
│                              │ [Open linked prompt] [Run eval] [Create incident]           │
└──────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### 设计重点

- 运行表和 trace 详情必须同屏联动。
- Trace inspector 要能直达 Prompt、Eval、Approval、Incident。
- 这里应是“调试入口”，不是日志归档页。

## 7. Prompts 页面

Prompt 页面应该接近“版本控制 + 对比 + 回滚 + 发布流水线”。

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Prompts                                                              [New Draft] [Compare] │
├──────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ Prompt List                  │ Prompt Editor / Release Panel                               │
│ - admin-copilot/system       │ Prompt ID: pmpt_admin_copilot_system                        │
│ - audit-analyst/review       │ Status: draft                                               │
│ - report-summary             │                                                             │
│                              │ Variables                                                    │
│                              │ {{user_goal}} {{role_context}} {{knowledge_snippets}}       │
│                              │                                                             │
│                              │ Prompt body                                                  │
│                              │ -----------------------------------------------------------  │
│                              │ system: ...                                                  │
│                              │ user: ...                                                    │
│                              │ -----------------------------------------------------------  │
│                              │                                                             │
│                              │ History                                                     │
│                              │ v12 / v13 / v14 / v15-draft                                │
│                              │                                                             │
│                              │ Linked evals / release checks                              │
│                              │ [Run test set] [Preview diff] [Submit approval] [Rollback] │
└──────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### 设计重点

- Prompt 不是纯文本页，而是治理对象。
- 必须体现变量、版本、diff、linked evals、release gate。
- 和 OpenAI Playground / Braintrust 的工作流接近，但更偏企业治理。

## 8. Evals 页面

这里不只是跑分，而是“发布前质量门”。

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Evals                                                              [Run suite] [New scorer] │
├──────────────────────┬──────────────────────┬──────────────────────┬───────────────────────┤
│ Overall score        │ Safety               │ Task success         │ Regression            │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ SUITE TABLE                                                                                 │
│ suite            target            dataset        scorer         last score   trend         │
│ admin-copilot    prompt v15        prod-samples   correctness    0.81         down         │
├──────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ CASE LIST                    │ CASE DETAIL                                                  │
│ case 101 failed              │ input / expected / output                                    │
│ case 102 passed              │ per-scorer breakdown                                         │
│ case 103 failed              │ trace link                                                   │
│                              │ [Send feedback] [Open prompt] [Pin baseline]                 │
└──────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### 设计重点

- Eval 结果必须能 drill down 到 case。
- case 必须能回连 trace 和 prompt。
- 这里应该是发布 gate，不是实验室角落。

## 9. Knowledge 页面

知识库不该只是文件管理，而要体现检索质量。

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Knowledge                                                            [Connect source]       │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ Source health: [freshness] [index lag] [retrieval hit rate] [failed syncs]                │
├──────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ SOURCE / COLLECTIONS         │ KNOWLEDGE DETAIL                                             │
│ Notion HR                    │ Collection: Policies                                         │
│ Feishu SOP                   │                                                             │
│ Drive Product Docs           │ retrieval quality chart                                      │
│                              │ top failing queries                                          │
│                              │ stale documents                                              │
│                              │ chunk coverage                                               │
│                              │ citations preview                                            │
│                              │                                                             │
│                              │ [Run retrieval test] [Resync] [Re-index] [View citations]   │
└──────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### 设计重点

- 核心对象是 `retrieval quality`，不是文件本身。
- 要让运营人员能看到“为什么 Agent 回答差”，而不是只看到上传状态。

## 10. Govern 页面

Govern 是区别于普通 AI 工具的关键页，要把“审批、审计、策略”放在一个工作台里。

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Governance Center                                                   [New policy]            │
├──────────────────────────────┬─────────────────────────────────────────────────────────────┤
│ APPROVAL QUEUE               │ GOVERNANCE DETAIL                                            │
│ - Prompt release v15         │ Request: Prompt release v15                                  │
│ - Agent tool expansion       │ Risk: medium                                                 │
│ - Role permission change     │                                                             │
│                              │ Evidence                                                     │
│                              │ - eval summary                                               │
│                              │ - trace samples                                              │
│                              │ - impacted roles                                             │
│                              │ - audit diff                                                 │
│                              │                                                             │
│                              │ Policy checks                                                │
│                              │ ✓ audit logging enabled                                      │
│                              │ ✓ RBAC unchanged                                             │
│                              │ ! eval regression unresolved                                 │
│                              │                                                             │
│                              │ [Approve] [Reject] [Request changes]                        │
└──────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### 设计重点

- 不能把审批做成普通弹窗。
- 审批需要证据包，而不是一句描述。
- Prompt、Agent、Permission、Knowledge 变更都要汇聚到这里。

## 11. Workspace 页面

为了体现 Human-in-the-Loop，需要一个人类操作中枢。

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Workspace Inbox                                                          [My tasks]         │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ Today                                                                                      │
│ - review failed eval for admin-copilot                                                     │
│ - approve knowledge resync for finance docs                                                │
│ - inspect degraded run cluster                                                              │
├───────────────────────────────────────────────┬────────────────────────────────────────────┤
│ Task Queue                                    │ Session / Handoff                           │
│ owner / type / priority / due                 │ who investigated / summary / next action   │
└───────────────────────────────────────────────┴────────────────────────────────────────────┘
```

### 设计重点

- AI-native 系统必须显式体现 human review loop。
- 用户的任务应该来源于运行态，而不是手工创建为主。

## 12. 移动端原则

这类产品不适合完整移动管理，但要支持“审批、查看告警、快速追踪”。

```text
┌──────────────────────────────────────┐
│ AI Ops Center         [alerts: 3]    │
├──────────────────────────────────────┤
│ Critical queue                        │
│ - prompt release waiting             │
│ - degraded run cluster               │
│ - kb sync failed                     │
├──────────────────────────────────────┤
│ Quick actions                         │
│ [Approve] [Open trace] [Ask copilot] │
└──────────────────────────────────────┘
```

## 13. 视觉语言建议

- 不要使用“标准 SaaS 空白底 + 小卡片九宫格”。
- 更接近“控制台 / 作战室 / 观测台”。
- 建议视觉层级：
  - 深色或中性色导航骨架
  - 主工作区高对比白底或浅灰底
  - 关键状态用清晰语义色，不用装饰渐变
- 页面中多使用：
  - 时间线
  - 关系图
  - compare diff
  - inspector drawer
  - release pipeline

## 14. 与当前代码的落地映射

如果继续实现，建议分三段重构：

1. 重做导航信息架构
   - 把 `system / monitor / ai` 改成生命周期分组
   - `Admin` 下沉，`Build / Observe / Improve / Govern` 上升

2. 重做右侧 Copilot
   - 从 chat panel 改成 `context rail + chat + actions`
   - 接入当前 route object、权限、最近 runs、推荐操作

3. 先落三个标志性页面
   - `Home / AI Operations Center`
   - `Observe / Runs`
   - `Govern / Approvals`

这三个页一旦成型，产品气质会立刻从“普通后台”切到“AI-native 控制台”。

