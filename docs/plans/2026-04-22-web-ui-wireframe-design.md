# Web UI 草图设计

基于以下文档整理：

- `Challenge.md`
- `docs/architecture.md`
- `docs/api-conventions.md`
- `docs/rbac-design.md`
- `docs/ai-agent-design.md`
- 当前实现：`apps/web/src/components/shell/dashboard-shell.tsx`
- 当前实现：`apps/web/src/components/copilot/copilot-panel.tsx`

## 1. 设计边界

- 这是后台控制台，不是营销站点。
- Web 端必须采用“双工作区”结构：左侧传统管理导航，右侧可折叠 AI Copilot 工作台。
- 菜单、按钮、页面入口必须受 RBAC 控制，不允许前端静态暴露越权入口。
- AI 能力必须体现三种状态：`ready`、`degraded`、`offline`。
- 当前草图以“最小安全集”作为主入口，不把 `planned` 模块误画成已上线模块。

## 2. 当前 Web 信息架构

```text
Control Console
├─ Dashboard / Reports
├─ System
│  ├─ Users
│  ├─ Roles
│  ├─ Permissions
│  └─ Menus
├─ Monitor
│  ├─ Online
│  └─ Server
├─ AI Governance
│  ├─ Knowledge
│  ├─ Evals
│  ├─ Audit
│  └─ Prompts
└─ Copilot Workspace
   ├─ Route Brief
   ├─ Session / Capability
   ├─ Chat Stream
   └─ Read-only Focus Cards
```

## 3. 全局壳层草图

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR                                                                                      │
│ [模块标签]  页面标题  页面说明                                   [roles] [assistant:ready]  │
│                                                                       [Hide assistant]      │
├──────────────────────┬──────────────────────────────────────────────────────┬────────────────┤
│ LEFT SIDEBAR         │ MAIN WORKSPACE                                       │ AI COPILOT     │
│                      │                                                      │                │
│ AI Native OS         │  页面级内容区                                        │ Route Brief    │
│ Control Console      │  - KPI / 表格 / 表单 / 审计流                         │ Capability     │
│                      │  - 所有业务操作都在这里完成                           │ Session Context│
│ Current Operator     │                                                      │ Suggested Acts │
│ name / email         │                                                      │ Chat Timeline  │
│ [role] [role]        │                                                      │ Focus Card     │
│                      │                                                      │                │
│ Navigation Groups    │                                                      │                │
│ - Dashboard          │                                                      │                │
│ - System             │                                                      │                │
│ - Monitor            │                                                      │                │
│ - AI                 │                                                      │                │
│                      │                                                      │                │
│ Shell Summary        │                                                      │                │
│ Sign out             │                                                      │                │
└──────────────────────┴──────────────────────────────────────────────────────┴────────────────┘
```

### 壳层交互说明

- 左栏固定，承担“模块切换 + 当前操作者身份信息 + 角色标签”。
- 顶栏只显示当前路由上下文，不重复堆叠全局导航。
- 主工作区优先给业务页面，AI 面板默认展开但不抢占主视线。
- AI 面板折叠后保留窄栏状态卡，只显示状态与重新打开入口。

## 4. 首页 / Dashboard 草图

适合做成“运营态势 + AI 工作建议”的首屏，而不是通用欢迎页。

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Dashboard                                                                  │
│ 系统总览与今日 AI 治理重点                                                  │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ KPI 01               │ KPI 02               │ KPI 03                        │
│ Active users         │ Pending reviews      │ AI audit alerts               │
├──────────────────────┴──────────────────────┴───────────────────────────────┤
│ Trend / Health Strip                                                         │
│ [API latency] [queue] [error rate] [model availability]                     │
├───────────────────────────────────────────────┬─────────────────────────────┤
│ Recent Operations                             │ AI Recommendations           │
│ - latest logs                                 │ - review failed eval run     │
│ - risky permission changes                    │ - inspect knowledge drift    │
│ - report exports                              │ - check audit anomalies      │
├───────────────────────────────────────────────┴─────────────────────────────┤
│ Approval / Attention Queue                                                     │
│ 需要人工确认的治理事项、Prompt 变更、异常审计、待复核报表                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5. System / Users 草图

用户管理页要明确区分“查询主视图”和“侧滑编辑动作”，避免全屏弹窗打断上下文。

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Users                                         [Search........] [Filter] [+] │
│ 用户目录、角色分配、状态治理                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tabs: [All] [Enabled] [Disabled] [Recently Updated]                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ TABLE                                                                       │
│ □ Name      Email              Roles            Status    Updated    Actions │
│ □ Alice     alice@...          admin,editor     active    2h ago     ...    │
│ □ Bob       bob@...            viewer           disabled  1d ago     ...    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Bulk Bar: [Assign role] [Disable] [Export]                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Row Action / Side Sheet
┌──────────────────────────────────────┐
│ User Detail                          │
│ Basic info                           │
│ Role bindings                        │
│ Permission summary (read only)       │
│ Audit trail                          │
│ [Save] [Disable user]                │
└──────────────────────────────────────┘
```

## 6. System / Roles + Permissions 草图

这里不能只做 CRUD，要把“影响面”可视化，因为文档明确强调动态 RBAC 和条件级权限。

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Roles & Permissions                                                          │
├──────────────────────────────┬──────────────────────────────────────────────┤
│ LEFT: Role List              │ RIGHT: Ability Composer                      │
│ - super_admin                │ Role: editor                                 │
│ - admin                      │                                              │
│ - editor                     │ Permission Matrix                            │
│ - viewer                     │ Resource     read create update delete ...   │
│                              │ User         ✓    -      -      -            │
│                              │ Role         ✓    -      -      -            │
│                              │ Report       ✓    -      -      export       │
│                              │                                              │
│                              │ Conditions / Fields                          │
│                              │ {"organizationId":"${user.orgId}"}          │
│                              │                                              │
│                              │ Impact Preview                               │
│                              │ - visible menus                              │
│                              │ - enabled routes                             │
│                              │ - affected agents/tools                      │
│                              │                                              │
│                              │ [Save role] [Audit changes]                  │
└──────────────────────────────┴──────────────────────────────────────────────┘
```

## 7. AI / Knowledge 草图

知识库页是 RAG 治理入口，不是普通文件列表。核心是“内容状态 + 检索可用性 + 版本证据”。

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Knowledge Base                             [Upload] [Sync] [Re-index]       │
├─────────────────────────────────────────────────────────────────────────────┤
│ Source Health                                                               │
│ [documents] [chunks] [embedding freshness] [failed jobs]                    │
├──────────────────────────────┬──────────────────────────────────────────────┤
│ LEFT: Collection List        │ RIGHT: Document Detail                       │
│ - Policies                   │ title / source / tags                        │
│ - Runbooks                   │ status: indexed / stale / failed             │
│ - FAQs                       │ chunk summary                                │
│                              │ embedding timeline                           │
│                              │ evidence / citations                         │
│                              │ audit trail                                  │
│                              │ [Preview] [Replace version] [Archive]        │
└──────────────────────────────┴──────────────────────────────────────────────┘
```

## 8. AI / Evals + Audit 草图

Evals 和 Audit 是 AI 治理核心，建议使用“上方总览 + 下方事件流/结果表”的结构。

```text
AI / Evals
┌─────────────────────────────────────────────────────────────────────────────┐
│ Eval Runs                                    [Run eval] [Compare baseline]  │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ pass rate            │ avg latency          │ regression count              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Run Table                                                                     │
│ id   scorer   dataset   model   score   status   startedAt   action          │
└─────────────────────────────────────────────────────────────────────────────┘

AI / Audit
┌─────────────────────────────────────────────────────────────────────────────┐
│ Decision Audit                               [Semantic Search...........]    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Timeline                                                                       │
│ [time] agent invoked                                                          │
│ [time] tool requested                                                         │
│ [time] permission checked                                                     │
│ [time] human approval required                                                │
│ [time] final output stored                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Detail Drawer                                                                  │
│ prompt version / tool inputs / tool outputs / evidence / audit hash           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9. Monitor / Server 草图

监控页不应照搬云监控产品，而是聚焦“后台管理系统 + AI runtime”双栈健康度。

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Server & Runtime Health                                                       │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ API                  │ Database             │ AI Runtime                     │
│ latency / errors     │ conn / storage       │ model key / stream / queue     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Infra Panels                                                                  │
│ - Redis / Cache                                                               │
│ - Trigger.dev jobs                                                            │
│ - WebSocket / SSE                                                             │
│ - OpenTelemetry / trace sampling                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Incident Feed                                                                  │
│ 最近 1h 的退化、失败、限流、告警                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10. 移动端折叠草图

移动端只保留一个主列，导航改成顶部横向滚动 chips，Copilot 面板收进抽屉。

```text
┌──────────────────────────────────────┐
│ Page Title          [assistant badge]│
│ page description                      │
├──────────────────────────────────────┤
│ [Dashboard] [System] [Monitor] [AI]  │
├──────────────────────────────────────┤
│ Main content                          │
│ cards / list / forms                  │
│                                       │
├──────────────────────────────────────┤
│ Floating action: Open Copilot         │
└──────────────────────────────────────┘
```

## 11. 视觉方向建议

- 保持当前“冷灰底 + 轻边框 + 高信息密度”的控制台语言，不做花哨营销风。
- 用状态色区分治理风险：
  - 蓝色：普通信息
  - 琥珀色：待确认 / degraded
  - 红色：风险 / 失败 / 审计异常
  - 绿色：通过 / 健康
- Copilot 面板使用更强的卡片层次，但不要比主工作区更抢眼。
- AI 页签统一增加 `Route Brief` 和 `Guardrail` 区，持续提示能力边界。

## 12. 实现优先级建议

如果后续要把草图继续落成页面，建议顺序：

1. Dashboard 总览页
2. Users 页查询表格 + 侧滑详情
3. Roles / Permissions 影响面视图
4. AI Knowledge / Evals / Audit 三页统一治理框架
5. Mobile Copilot 抽屉

