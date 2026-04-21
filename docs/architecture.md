# AI Native 后台管理系统 — 完整架构文档

> **项目代号**：AI Native OS
> **版本**：v1.0
> **日期**：2026 年 3 月
> **定位**：面向 2026 年最佳实践的 TypeScript 全栈 AI Native 后台管理系统

---

## 一、架构愿景

### 1.1 核心理念

本系统不是"加了 AI 功能的后台管理系统"，而是**以 AI 为核心推理引擎、从底层重新设计的后台管理平台**。如果移除 AI 层，系统将失去核心价值而非仅仅缺少一个功能模块。

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **AI Native** | AI 是系统大脑，非功能附加品 |
| **Type Safety First** | 端到端类型安全，从数据库 → API → 前端全链路 |
| **Protocol Driven** | 基于 AG-UI / MCP / A2A 标准协议，无厂商锁定 |
| **Edge First** | 优先边缘部署，全球低延迟 |
| **Human-in-the-Loop** | AI 自主执行 + 人工审核确认的协作模式 |
| **Continuous Learning** | 系统通过反馈持续自我改进 |

---

## 二、五层 AI Native 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 5: 反馈学习层                           │
│         AI 决策审计 · 人工修正收集 · Evals 评估 · Prompt 版本管理  │
├─────────────────────────────────────────────────────────────────┤
│                    Layer 4: Agentic 业务流层                     │
│      Mastra Agent · Workflow · Human-in-the-Loop · MCP Server   │
├─────────────────────────────────────────────────────────────────┤
│                    Layer 3: Generative UI 层                    │
│        CopilotKit · AG-UI 协议 · assistant-ui · A2UI            │
├─────────────────────────────────────────────────────────────────┤
│                    Layer 2: 上下文工程层                         │
│           Mastra RAG · Memory · pgvector · 知识库                │
├─────────────────────────────────────────────────────────────────┤
│                    Layer 1: LLM 编排层                           │
│       Mastra Core · Vercel AI SDK · 模型路由 · 工具调用           │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 0: 工程基础设施层                       │
│   Hono · oRPC · Drizzle · PostgreSQL · Next.js · Turborepo      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、完整技术栈清单

### 3.1 工程化基座

| 分类 | 技术 | 版本 | 说明 |
|------|------|------|------|
| Monorepo | **Turborepo** | latest | 任务编排、远程缓存、并行构建 |
| 包管理 | **pnpm** | 10.x | 统一包管理器，workspace 协议 |
| 运行时 | **Bun** (开发) / **Node.js** (生产) | Bun 1.x / Node 22 LTS | Bun 仅 `bun run`，不做包管理 |
| 构建工具 | **Vite** | 6.x | 仅用于共享 UI 库 / 工具包构建（不用于 Next.js） |
| 代码规范 | **Biome** | latest | 替代 ESLint + Prettier |

### 3.2 后端核心

| 分类 | 技术 | 说明 |
|------|------|------|
| Web 框架 | **Hono** | 轻量多运行时框架（Edge / Node / Bun） |
| API 协议 | **oRPC** | 端到端类型安全 + 一等 OpenAPI 3.1 支持 |
| API 文档 | **Scalar UI** | 基于 oRPC 自动生成的 OpenAPI 3.1 规范渲染 |
| 数据库 | **PostgreSQL** (Neon) | 关系型数据库 + pgvector 扩展（RAG 向量检索） |
| ORM | **Drizzle** | TypeScript 优先，贴近 SQL |
| 验证 | **Zod** | Schema 验证 + 类型推导，前后端共享 |
| 缓存 | **Upstash Redis** (Edge) / **Redis** (Docker) | 分层：HTTP Redis 用于 Edge，TCP Redis 用于容器 |
| 认证 | **Better Auth**（当前） + **JWT**（目标态可选） | 当前仓库以 Better Auth 会话为主；JWT 仅保留为后续扩展口径 |
| 权限 | **CASL** + **自建 RBAC** | 前后端同构权限引擎 + DB 存储角色权限 |
| 任务队列 | **Trigger.dev v4** (重型) + **Cloudflare Queues** (轻量) | 当前仓库已使用 Trigger.dev v4 包；任务文件仍走官方 v3-compatible import surface |
| Excel | **excelize-wasm** | WASM 方案，Edge / Serverless 兼容 |
| API 限流 | **Hono 中间件限流基线** | 当前仓库使用自研 Hono middleware 实现生产默认限流，而不是直接接官方 Hono Rate Limiter 包 |

> **Trigger.dev 已升级至 v4 GA**：v4 要求自定义队列（及其并发限制）必须预先定义，解决了 v3 中动态创建队列导致的并发限制混乱问题。V4 已准备好用于生产工作负载。

### 3.3 前端核心

| 分类 | 技术 | 说明 |
|------|------|------|
| 框架 | **Next.js** (Turbopack) | React 全栈框架，SSR / SSG / RSC |
| 样式 | **Tailwind CSS** | 实用优先 CSS |
| UI 组件 | **shadcn-ui** | 可定制、可复制的组件库 |
| 状态管理 | **zustand** | 轻量全局状态 |
| 数据请求 | **TanStack React Query v5** + **oRPC Client** | oRPC 开箱即用 TanStack Query 集成 |
| 表单 | **React Hook Form** + **Zod resolver** | 与 shadcn Form 原生兼容 |
| 数据表格 | **TanStack Table v8** | 排序 / 筛选 / 分页 / 虚拟滚动 |
| 国际化 | **next-intl** | Next.js 原生 i18n |
| 前端权限 | **CASL** | 控制 UI 按钮 / 菜单显示隐藏 |

### 3.4 AI Native 技术栈（核心差异化）

#### Layer 1：LLM 编排层

| 分类 | 技术 | 说明 |
|------|------|------|
| AI Agent 框架 | **Mastra** | 专为 TypeScript 设计、围绕成熟的 AI 模式构建，提供开箱即用的一切。模型路由——通过一个标准接口连接 40+ 提供商，使用 OpenAI、Anthropic、Gemini 等模型。 |
| AI SDK | **Vercel AI SDK** | 流式响应、模型切换、AI UI 组件 |
| Mastra + Hono 集成 | **@mastra/hono** | Mastra 的新 Server Adapter 自动将你的 Agent、Workflow、Tool 和 MCP Server 暴露为 HTTP 端点。Mastra 1.0 引入了多个适配器包，使在现有 Express、Hono、Fastify 或 Koa 应用中运行 Mastra 变得更容易设置和维护。 |

#### Layer 2：上下文工程层

| 分类 | 技术 | 说明 |
|------|------|------|
| 向量数据库 | **pgvector** (PostgreSQL 扩展) | RAG 检索增强生成，复用现有 PostgreSQL |
| RAG | **Mastra RAG** | 开箱即用的文档分块、嵌入和向量搜索，支持检索增强生成。 |
| Agent Memory | **Mastra Memory** | 通过结合 Mastra 的持久化内存系统和 Agent 编排与 Trigger.dev 的持久任务执行、重试和可观测性，构建可在失败中存活、自动扩展并跨长时间运行操作维护上下文的生产级 AI 工作流。 |
| 知识库存储 | **PostgreSQL** + Mastra Storage | 业务文档 / 操作手册 / FAQ / 历史操作记录 |

#### Layer 3：Generative UI 层

| 分类 | 技术 | 说明 |
|------|------|------|
| Agentic UI 框架 | **CopilotKit** | CopilotKit 提供 React 组件来快速集成可定制的 AI Copilot 到你的应用。结合 Mastra，可以构建具有双向状态同步和交互式 UI 的复杂 AI 应用。 |
| AI Chat UI | **CopilotKit 自定义面板**（当前） / **assistant-ui**（目标态可选） | 当前仓库已落地 route-aware Copilot panel 与 AG-UI bridge；assistant-ui 仍保留为后续可选升级方向 |
| Agent-User 协议 | **AG-UI** | AG-UI 是一个开放、轻量、基于事件的协议，标准化 AI Agent 如何连接到面向用户的应用。为简单性和灵活性而构建，实现 AI Agent、实时用户上下文和用户界面之间的无缝集成。 |
| Agent 生成式 UI | **A2UI** (Google) | A2UI 旨在解决可互操作、跨平台、生成式或模板式 Agent UI 响应的特定挑战。A2UI 允许 Agent 生成最适合当前对话的界面，并发送给前端应用。 |

> **协议栈关系说明**：MCP（模型上下文协议）和 A2A（Agent 间通信）处理上下文和 Agent 协调，AG-UI 定义用户、应用和 Agent 之间的交互层。尽管缩写相似，它们是不同的，可以很好地协同工作。A2UI 是一个生成式 UI 规范（来自 Google），Agent 可以用它来交付 UI 组件，而 AG-UI 提供任何 Agentic 后端和面向用户应用之间完整的双向运行时连接。

#### Layer 4：Agentic 业务流层

| 分类 | 技术 | 说明 |
|------|------|------|
| Agent | **Mastra Agent** | 构建使用 LLM 和工具解决开放式任务的自主 Agent。Agent 对目标进行推理，决定使用哪些工具，并在内部迭代直到模型产生最终答案或满足可选的停止条件。 |
| Workflow | **Mastra Workflow** | 当需要显式控制执行时，使用基于图的工作流引擎编排复杂的多步骤流程。使用直观语法（.then()、.branch()、.parallel()）。Human-in-the-loop——暂停 Agent 或工作流，等待用户输入或批准后再继续。 |
| MCP Server | **`@modelcontextprotocol/sdk` 兼容实现**（当前） / **`@mastra/mcp`**（目标态） | 当前仓库使用 MCP 官方 SDK 保持真实协议与 Hono 集成，`@mastra/mcp` 仍是架构蓝图选项 |
| MCP Client | **`@ai-sdk/mcp` + 外部 MCP 配置**（当前） / **`@mastra/mcp`**（目标态） | 当前仓库已接通外部 MCP client；`@mastra/mcp` 仍保留为未来统一化方案 |
| 任务持久化 | **Trigger.dev v4** | Mastra 处理 AI Agent 内存和协调，而 Trigger.dev 处理编排、可靠性、可观测性和扩展。 |

#### Layer 5：反馈学习层

| 分类 | 技术 | 说明 |
|------|------|------|
| AI 评估 | **Mastra Evals** | Mastra 现在包含一等公民的评估原语：版本化的 Dataset 和可运行的 Experiment，旨在帮助你持续衡量质量。Dataset 是评估项的集合（通过 JSON Schema 验证），具有 SCD-2 风格的项目版本控制。Experiment 让你针对数据集项运行 Agent，用可配置的评分器对输出打分，并随时间追踪结果。 |
| AI 可观测性 | **Mastra AI Tracing** + **OpenTelemetry** | 运行可靠的 Agent 需要持续的洞察、评估和迭代。通过内置的 Evals 和可观测性，Mastra 提供观察、衡量和持续改进的工具。 |
| 决策审计 | 自建审计日志表（Drizzle） | 所有 AI 操作可追溯、可审计 |
| Prompt 管理 | Mastra + 自建版本控制 | A/B 测试不同 Agent 策略 |

### 3.5 通信 & 监控

| 分类 | 技术 | 说明 |
|------|------|------|
| 实时通信 | **WebSocket** (Hono WS / CF Durable Objects) | 通知推送、在线状态 |
| Agent 流式通信 | **AG-UI over SSE/WebSocket** | AG-UI 是一个开放、轻量的协议，通过标准 HTTP 或可选的二进制通道流式传输 JSON 事件序列。这些事件——消息、工具调用、状态补丁、生命周期信号——在你的 Agent 后端和前端界面之间无缝流动，维持完美的实时同步。 |
| 邮件服务 | **Resend** + **React Email** | 开发体验优秀的邮件方案 |
| 日志监控 | **OpenTelemetry** + **Sentry** / **LogTape** | 全链路可观测性 |

### 3.6 部署 & 基础设施

| 分类 | 技术 | 说明 |
|------|------|------|
| 前端部署 | **Vercel** (或 Cloudflare Pages) | Next.js 原生平台 |
| Edge 计算 | **Cloudflare Workers/Pages** | 边缘 API、轻量任务 |
| 边缘队列 | **Cloudflare Queues** | 轻量异步任务（通知、缓存失效） |
| 文件存储 | **本地存储** + **Cloudflare R2** / **AWS S3** | 适配器模式，灵活切换 |
| 容器化 | **Docker** + **CI/CD** | API + Trigger.dev 自托管 + Redis + PG |
| 定时任务 | **Trigger.dev Scheduled Tasks** | 定期触发（报表生成、数据同步） |

---

## 四、协议栈架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        用户 (Browser)                            │
├──────────────────────────────────────────────────────────────────┤
│  CopilotKit React Components + assistant-ui + shadcn-ui          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  AI Copilot 面板  │  │ 传统管理 UI 页面  │  │ Generative UI │  │
│  │  (assistant-ui)  │  │ (shadcn + Table) │  │  (A2UI 渲染)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           │                     │                     │          │
│      AG-UI 协议            oRPC Client           AG-UI 协议      │
│    (SSE/WebSocket)     (TanStack Query)        (SSE/WebSocket)   │
├───────────┼─────────────────────┼─────────────────────┼──────────┤
│           ▼                     ▼                     ▼          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      Hono API Server                        │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │ │
│  │  │  oRPC    │  │ Mastra Hono  │  │ CopilotKit Backend    │ │ │
│  │  │ 路由层   │  │  Adapter     │  │ (AG-UI Endpoint)      │ │ │
│  │  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘ │ │
│  │       │               │                       │             │ │
│  │       ▼               ▼                       ▼             │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │                   Mastra Core                        │   │ │
│  │  │  ┌─────────┐ ┌──────────┐ ┌─────┐ ┌──────────────┐ │   │ │
│  │  │  │ Agents  │ │Workflows │ │Tools│ │  MCP Server   │ │   │ │
│  │  │  │         │ │          │ │     │ │  + Client     │ │   │ │
│  │  │  └────┬────┘ └────┬─────┘ └──┬──┘ └──────┬───────┘ │   │ │
│  │  │       │           │          │            │         │   │ │
│  │  │  ┌────▼───────────▼──────────▼────────────▼──────┐  │   │ │
│  │  │  │  RAG · Memory · pgvector · AI Tracing · Evals │  │   │ │
│  │  │  └───────────────────────────────────────────────┘  │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                        数据 & 基础设施层                         │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────┐ │
│  │ PostgreSQL  │ │ Upstash Redis│ │Trigger.dev │ │Cloudflare │ │
│  │ + pgvector  │ │ / Redis      │ │ v4         │ │R2/Queues  │ │
│  └─────────────┘ └──────────────┘ └────────────┘ └───────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 五、Monorepo 目录蓝图

> 当前实现口径（2026-04-03）：
> - Mastra 运行时当前只注册 `admin-copilot`、`audit-analyst` 和 `report-schedule`
> - 下方目录树用于表达目标态结构，包含后续扩展蓝图文件名
> - 目录树中的 `data-analyst`、`approval-agent`、`anomaly-detector`、`report-generator`、`approval-flow`、`data-cleanup`、`onboarding` 不应被误读为“当前仓库已经全部实现并注册”

```
📦 ai-native-os (Turborepo + pnpm)
│
├── 📂 apps/
│   │
│   ├── 📂 web/                              # Next.js — 前端管理后台
│   │   ├── app/
│   │   │   ├── (auth)/                      # 认证相关页面
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/                 # 管理后台主体
│   │   │   │   ├── layout.tsx               # Dashboard 布局 + AI Copilot 面板
│   │   │   │   ├── dashboard/               # 智能仪表盘（AI 驱动）
│   │   │   │   ├── system/                  # 系统管理
│   │   │   │   │   ├── users/               # 用户管理（AI 增强）
│   │   │   │   │   ├── roles/               # 角色管理
│   │   │   │   │   ├── permissions/         # 权限管理
│   │   │   │   │   ├── menus/               # 菜单管理
│   │   │   │   │   ├── dicts/               # 字典管理
│   │   │   │   │   └── config/              # 系统配置
│   │   │   │   ├── monitor/                 # 系统监控（AI 增强）
│   │   │   │   │   ├── online/              # 在线用户
│   │   │   │   │   ├── logs/                # 操作日志（AI 语义搜索）
│   │   │   │   │   ├── server/              # 服务监控
│   │   │   │   │   └── cache/               # 缓存监控
│   │   │   │   ├── ai/                      # AI 专属模块
│   │   │   │   │   ├── copilot/             # AI Copilot 设置
│   │   │   │   │   ├── agents/              # Agent 管理（查看 / 配置 / 测试）
│   │   │   │   │   ├── workflows/           # AI 工作流管理
│   │   │   │   │   ├── knowledge/           # 知识库管理（RAG 文档）
│   │   │   │   │   ├── evals/               # AI 评估面板
│   │   │   │   │   └── audit/               # AI 决策审计日志
│   │   │   │   └── tools/                   # 工具模块
│   │   │   │       ├── gen/                 # 代码生成器
│   │   │   │       └── jobs/                # 任务调度管理
│   │   │   └── api/                         # Next.js API Routes
│   │   │       ├── copilotkit/              # CopilotKit AG-UI 端点
│   │   │       └── ai/                      # AI 流式端点 (Vercel AI SDK)
│   │   ├── components/
│   │   │   ├── ui/                          # shadcn-ui 组件
│   │   │   ├── copilot/                     # AI Copilot 组件
│   │   │   │   ├── copilot-sidebar.tsx      # AI 侧边栏（CopilotKit）
│   │   │   │   ├── copilot-chat.tsx         # AI 聊天窗（assistant-ui）
│   │   │   │   ├── generative-table.tsx     # AI 生成表格视图
│   │   │   │   ├── generative-form.tsx      # AI 智能填充表单
│   │   │   │   ├── generative-chart.tsx     # AI 生成图表
│   │   │   │   └── nl-filter.tsx            # 自然语言筛选器
│   │   │   ├── layout/                      # 布局组件
│   │   │   └── business/                    # 业务组件
│   │   ├── hooks/
│   │   │   ├── use-ability.ts               # CASL 权限 Hook
│   │   │   ├── use-copilot.ts               # AI Copilot Hook
│   │   │   └── use-nl-query.ts              # 自然语言查询 Hook
│   │   ├── lib/
│   │   │   ├── orpc.ts                      # oRPC 客户端配置
│   │   │   ├── ability.ts                   # CASL 前端权限实例
│   │   │   └── query-client.ts              # TanStack Query 配置
│   │   └── messages/                        # next-intl 国际化文件
│   │       ├── en.json
│   │       └── zh.json
│   │
│   ├── 📂 api/                              # Hono — API 服务
│   │   ├── src/
│   │   │   ├── index.ts                     # Hono App 入口
│   │   │   ├── routes/                      # oRPC 路由定义
│   │   │   │   ├── system/                  # 系统管理 API
│   │   │   │   │   ├── users.ts
│   │   │   │   │   ├── roles.ts
│   │   │   │   │   ├── permissions.ts
│   │   │   │   │   ├── menus.ts
│   │   │   │   │   ├── dicts.ts
│   │   │   │   │   └── config.ts
│   │   │   │   ├── monitor/                 # 监控 API
│   │   │   │   │   ├── online.ts
│   │   │   │   │   ├── logs.ts
│   │   │   │   │   └── server.ts
│   │   │   │   └── ai/                      # AI 相关 API
│   │   │   │       ├── knowledge.ts         # 知识库 CRUD
│   │   │   │       ├── evals.ts             # 评估结果查询
│   │   │   │       └── audit.ts             # AI 审计日志
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts                  # Better Auth 中间件
│   │   │   │   ├── permission.ts            # CASL 权限中间件
│   │   │   │   ├── rate-limit.ts            # Hono Rate Limiter
│   │   │   │   └── logger.ts                # 请求日志
│   │   │   ├── mastra/                      # Mastra 集成
│   │   │   │   ├── index.ts                 # Mastra 实例 + Hono Adapter
│   │   │   │   ├── agents/                  # AI Agents 定义
│   │   │   │   │   ├── admin-copilot.ts     # 后台管理 Copilot Agent
│   │   │   │   │   ├── data-analyst.ts      # 数据分析 Agent
│   │   │   │   │   ├── approval-agent.ts    # 审批助手 Agent
│   │   │   │   │   ├── anomaly-detector.ts  # 异常检测 Agent
│   │   │   │   │   └── report-generator.ts  # 报表生成 Agent
│   │   │   │   ├── workflows/               # AI 工作流定义
│   │   │   │   │   ├── approval-flow.ts     # 智能审批流
│   │   │   │   │   ├── data-cleanup.ts      # 数据清洗流
│   │   │   │   │   ├── report-schedule.ts   # 定期报表流
│   │   │   │   │   └── onboarding.ts        # 用户引导流
│   │   │   │   ├── tools/                   # Agent 工具定义
│   │   │   │   │   ├── user-management.ts   # 用户管理工具
│   │   │   │   │   ├── permission-query.ts  # 权限查询工具
│   │   │   │   │   ├── data-query.ts        # 数据查询工具（SQL 生成）
│   │   │   │   │   ├── excel-export.ts      # Excel 导出工具
│   │   │   │   │   └── notification.ts      # 通知发送工具
│   │   │   │   ├── mcp/                     # MCP 配置
│   │   │   │   │   ├── server.ts            # MCP Server（暴露后台能力）
│   │   │   │   │   └── client.ts            # MCP Client（连接外部工具）
│   │   │   │   ├── rag/                     # RAG 配置
│   │   │   │   │   ├── embeddings.ts        # 嵌入配置
│   │   │   │   │   └── retrieval.ts         # 检索配置
│   │   │   │   └── evals/                   # AI 评估
│   │   │   │       ├── scorers/             # 评分器定义
│   │   │   │       ├── datasets/            # 评估数据集
│   │   │   │       └── experiments.ts       # 实验配置
│   │   │   └── copilotkit/
│   │   │       └── chat-route.ts            # CopilotKit AG-UI 端点注册
│   │   └── package.json
│   │
│   ├── 📂 worker/                           # Cloudflare Workers
│   │   ├── src/
│   │   │   ├── index.ts                     # Worker 入口
│   │   │   ├── queues/                      # Cloudflare Queues 处理
│   │   │   │   ├── notification.ts          # 通知队列
│   │   │   │   └── cache-invalidation.ts    # 缓存失效队列
│   │   │   └── r2/                          # Cloudflare R2 文件处理
│   │   │       └── upload.ts
│   │   └── wrangler.toml
│   │
│   └── 📂 jobs/                             # Trigger.dev v4 — 后台任务
│       ├── src/
│       │   ├── trigger/
│       │   │   ├── ai-tasks/                # AI 相关任务
│       │   │   │   ├── rag-indexing.ts       # RAG 文档索引
│       │   │   │   ├── agent-workflow.ts     # Agent 工作流执行
│       │   │   │   ├── batch-analysis.ts     # 批量数据分析
│       │   │   │   └── eval-runner.ts        # AI 评估任务
│       │   │   ├── report-tasks/            # 报表任务
│       │   │   │   ├── excel-generation.ts   # Excel 报表生成
│       │   │   │   └── scheduled-reports.ts  # 定时报表
│       │   │   ├── system-tasks/            # 系统任务
│       │   │   │   ├── email-sender.ts       # 邮件发送
│       │   │   │   ├── data-sync.ts          # 数据同步
│       │   │   │   └── cleanup.ts            # 定期清理
│       │   │   └── feedback-tasks/          # 反馈学习任务
│       │   │       ├── collect-feedback.ts   # 收集人工修正
│       │   │       └── prompt-optimize.ts    # Prompt 优化
│       │   └── mastra/                      # 任务中的 Mastra 实例
│       │       └── index.ts
│       └── package.json
│
├── 📂 packages/
│   │
│   ├── 📂 shared/                           # 共享类型 & Schema
│   │   ├── src/
│   │   │   ├── schemas/                     # Zod Schemas（前后端共享）
│   │   │   │   ├── user.ts
│   │   │   │   ├── role.ts
│   │   │   │   ├── permission.ts
│   │   │   │   ├── menu.ts
│   │   │   │   ├── dict.ts
│   │   │   │   └── ai-audit.ts
│   │   │   ├── types/                       # 共享 TypeScript 类型
│   │   │   ├── constants/                   # 共享常量
│   │   │   └── abilities/                   # CASL Ability 定义（前后端共享）
│   │   │       ├── define-ability.ts
│   │   │       └── subjects.ts
│   │   └── package.json
│   │
│   ├── 📂 ui/                               # 共享 UI 组件库（Vite 构建）
│   │   ├── src/
│   │   │   ├── components/                  # 通用 UI 组件
│   │   │   └── index.ts
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── 📂 db/                               # Drizzle Schema & Migrations
│   │   ├── src/
│   │   │   ├── schema/                      # 数据库表定义
│   │   │   │   ├── users.ts
│   │   │   │   ├── roles.ts
│   │   │   │   ├── permissions.ts
│   │   │   │   ├── role-permissions.ts
│   │   │   │   ├── user-roles.ts
│   │   │   │   ├── menus.ts
│   │   │   │   ├── dicts.ts
│   │   │   │   ├── operation-logs.ts
│   │   │   │   ├── ai-audit-logs.ts         # AI 决策审计表
│   │   │   │   ├── ai-feedback.ts           # AI 反馈收集表
│   │   │   │   ├── ai-knowledge.ts          # 知识库文档表
│   │   │   │   └── ai-prompt-versions.ts    # Prompt 版本表
│   │   │   ├── migrations/                  # 数据库迁移文件
│   │   │   ├── seed/                        # 种子数据
│   │   │   └── index.ts                     # Drizzle 客户端导出
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   └── 📂 auth/                             # Better Auth 配置包
│       ├── src/
│       │   ├── server.ts                    # Better Auth 服务端配置
│       │   ├── client.ts                    # Better Auth 客户端配置
│       │   └── permissions.ts               # 权限与 CASL 桥接
│       └── package.json
│
├── 📂 docker/
│   ├── docker-compose.yml                   # 全栈本地开发 / 自托管
│   ├── docker-compose.prod.yml              # 生产环境
│   ├── Dockerfile.api                       # API 服务镜像
│   ├── Dockerfile.jobs                      # Trigger.dev Worker 镜像
│   └── nginx.conf                           # 反向代理配置（可选）
│
├── 📂 .github/
│   └── workflows/
│       ├── ci.yml                           # CI 流水线
│       ├── deploy-vercel.yml                # Vercel 部署
│       ├── deploy-cloudflare.yml            # Cloudflare 部署
│       └── deploy-docker.yml                # Docker 部署
│
├── biome.json                               # Biome 配置
├── turbo.json                               # Turborepo 配置
├── pnpm-workspace.yaml                      # pnpm workspace 配置
├── .env.example                             # 环境变量模板
└── README.md
```

---

## 六、AI Agent 系统设计

### 6.1 核心 Agent 定义

> 当前口径（2026-04-10）：
> - 下表同时包含“当前已注册最小安全集”和“目标蓝图”
> - `active` 仅表示已注册到运行时，不代表所有登录主体都一定能在 discovery 中看到
> - 真正是否可见、可执行，取决于当前主体的 RBAC 能力和 AI runtime capability

| Agent | 当前状态 | 职责 | discovery 约束 | 工作模式 |
|-------|------|------|------|----------|
| **Admin Copilot** | active | 全局只读 AI 助手，聚合用户目录、权限画像、运行时配置、知识检索与报表快照 | 仅在 `OPENAI_API_KEY` 已配置且主体同时满足 `read:User`、`read:Role`、`read:Config`、`export:Report`、`read:AiKnowledge` 时暴露 | 交互式（CopilotKit / AG-UI） |
| **Audit Analyst** | active | 审计与运维分析 Agent，聚合操作日志、AI 审计日志和系统快照 | 当前注册但默认不走公开 Copilot/MCP wrapper 暴露；后续如开放 discovery，必须先明确其主体级暴露策略 | 只读分析 |
| **Data Analyst** | planned | 数据分析与可视化 | 尚未注册，仍是目标蓝图 | 交互式 + 定时 |
| **Approval Agent** | planned | 智能审批（报销/请假/权限申请） | 尚未注册，仍是目标蓝图 | Human-in-the-Loop |
| **Anomaly Detector** | planned | 异常检测与告警 | 尚未注册，仍是目标蓝图 | 自动 + 告警 |
| **Report Generator** | planned | 自动生成业务报表 | 尚未注册，仍是目标蓝图 | 定时 (Trigger.dev) |

### 6.2 MCP Server 暴露的工具

后台管理系统本身作为 MCP Server，暴露标准化工具供外部 AI Agent 调用：

当前实现不是“已注册即暴露”的静态模型，而是：

1. 先由运行时注册表声明系统里存在的 Agent / Workflow / Tool
2. 再由当前登录主体的 RBAC 能力和 AI runtime capability 决定这次请求真正能看到的 wrapper tool

因此，`ask_<agentIdentifier>`、`run_<workflowKey>`、`tool_<name>` 只是**可能的暴露形态**，不是每个主体都固定可见。

```
当前最小安全集下的 MCP wrapper：
├── ask_admin_copilot          # 仅在 AI enabled 且主体满足 Admin Copilot 最小权限闭包时暴露
├── run_report_schedule        # 仅在主体具备 export:Report 时暴露
└── tool_user_directory        # 仅在主体具备 read:User 时暴露
```

当前默认 seed 角色下的典型行为：

| 主体 | `OPENAI_API_KEY` 缺失时 | `OPENAI_API_KEY` 已配置时 |
|------|------|------|
| `viewer` | 仅 `tool_user_directory` | 仅 `tool_user_directory` |
| `admin` | 仅 `tool_user_directory` | 仅 `tool_user_directory` |
| `editor` | `tool_user_directory` + `run_report_schedule` | `tool_user_directory` + `run_report_schedule` |
| `super_admin` | `tool_user_directory` + `run_report_schedule` | `tool_user_directory` + `run_report_schedule` + `ask_admin_copilot` |

约束：

- MCP discovery、Copilot bridge、runtime summary 必须共享同一 discovery 规则。
- “看得到就能执行；不能执行就不暴露”是当前实现基线。
- 文档中的目标蓝图工具（如 `ask_data_analyst`、`run_approval_flow`）在对应 Agent / Workflow 真正注册并收敛权限前，不应被视为当前可发现能力。

### 6.3 典型 Agentic 业务流示例

**智能审批工作流（Mastra Workflow + Human-in-the-Loop）：**

```
[用户提交报销]
    │
    ▼
[Step 1: AI 自动审查] ─── .then()
    │  ├── OCR 识别发票内容
    │  ├── 金额合理性检查（对比历史数据）
    │  └── 公司政策合规校验
    │
    ▼
[Step 2: 风险评估] ─── .branch()
    │
    ├── 低风险（金额<500 且合规）
    │   └── 自动批准 → 通知主管（抄送）
    │
    └── 高风险（金额>500 或异常）
        └── [Human-in-the-Loop] ─── .suspend()
            │  暂停等待主管审批
            │  AI 提供审批建议 + 风险评分
            │
            └── 主管决策 → .resume()
                │
                ▼
[Step 3: 后处理] ─── .parallel()
    ├── 记录审计日志（含 AI 决策链路）
    ├── 更新预算看板
    ├── 发送通知给申请人
    └── 收集反馈（主管是否采纳 AI 建议）
```

---

## 七、Generative UI 交互设计

### 7.1 CopilotKit + Mastra 集成架构

CopilotKit 不是在静态聊天气泡中显示 Mastra 的输出，而是将它们渲染为交互式 React 组件：可编辑、可点击、可协作的。用户可以引导、纠正并与 Agent 共同创作，全部在应用内完成。

通过使用 `@ag-ui/mastra` 的 `registerCopilotKit()` 辅助函数为 CopilotKit 前端创建聊天路由。安装依赖：`@ag-ui/mastra @mastra/client-js @mastra/core @ag-ui/core`。

当前实现补充约束（2026-04-10）：

- Copilot bridge 不会把所有已注册 Agent 静态返回给前端。
- bridge 会先按当前主体能力计算 `agentIds`，再决定默认 Agent 是否存在。
- 如果 AI capability 为 `degraded`，或主体对任何已注册 Agent 都不满足最小权限闭包，则后端返回降级/拒绝响应，而不是继续伪装“Copilot 可用”。

### 7.2 AG-UI 事件流

Agentic 应用打破了前端-后端开发中主导的简单请求/响应模型。Agent 是长时间运行的，会流式传输中间工作。Agent 是非确定性的，可以非确定性地控制应用 UI。Agent 同时混合结构化和非结构化 IO。Agent 需要用户交互式组合。AG-UI 是一个基于事件的协议，在 Web 的基础协议（HTTP、WebSockets）之上构建的抽象层，为 Agentic 时代设计。

### 7.3 传统 UI vs AI Native UI 对照

| 传统后台页面 | AI Native 增强方式 |
|-------------|-------------------|
| 用户列表 + 搜索框 | 自然语言筛选：「显示本月注册但未激活的 VIP 用户」|
| 手动填写表单 | AI 智能预填 + 字段推荐 + 合规检查 |
| 静态数据图表 | AI 主动异常高亮 + 归因分析 + 预测趋势 |
| 手动点击审批按钮 | AI 自动审查 + 风险评分 + 审批建议 |
| 下载 CSV 后 Excel 处理 | 「生成上月销售汇总 Excel 并邮件发给财务」|
| 查看操作日志列表 | 语义搜索：「找到最近谁修改了管理员权限配置」|
| 固定仪表盘布局 | AI 根据角色 / 使用习惯自动调整展示重点 |

---

## 八、数据库 Schema 设计（核心表）

### 8.1 RBAC 权限模型

```
┌──────────┐     ┌──────────────┐     ┌───────────┐
│  users   │────▶│  user_roles  │◀────│   roles   │
└──────────┘     └──────────────┘     └─────┬─────┘
                                            │
                                    ┌───────▼────────┐
                                    │role_permissions │
                                    └───────┬────────┘
                                            │
                                    ┌───────▼────────┐
                                    │  permissions   │
                                    │ resource       │
                                    │ action         │
                                    │ conditions     │ ← CASL conditions (JSON)
                                    └────────────────┘
```

### 8.2 AI Native 专属表

```
┌────────────────────┐    ┌──────────────────────┐
│  ai_audit_logs     │    │  ai_feedback         │
│ ──────────────     │    │ ─────────────        │
│ agent_id           │    │ audit_log_id (FK)    │
│ action             │    │ user_action          │  ← 用户对 AI 建议的实际操作
│ input              │    │ accepted             │  ← 是否采纳 AI 建议
│ output             │    │ correction           │  ← 人工修正内容
│ reasoning_chain    │    │ feedback_text        │
│ confidence_score   │    └──────────────────────┘
│ tokens_used        │
│ latency_ms         │    ┌──────────────────────┐
│ trace_id (OTel)    │    │  ai_prompt_versions  │
│ human_override     │    │ ─────────────        │
│ created_at         │    │ agent_id             │
└────────────────────┘    │ version              │
                          │ instructions         │
┌────────────────────┐    │ scoring_results      │
│  ai_knowledge      │    │ is_active            │
│ ──────────────     │    │ created_at           │
│ title              │    └──────────────────────┘
│ content            │
│ embedding (vector) │ ← pgvector
│ metadata (jsonb)   │
│ chunk_index        │
│ source_type        │
│ created_at         │
└────────────────────┘
```

---

## 九、部署架构

### 9.1 分层部署策略

```
┌─────────────────────────────────────────────────────────────────┐
│                    CDN + Edge Layer                              │
│                                                                 │
│  ┌─────────────────────┐    ┌──────────────────────────────┐   │
│  │     Vercel           │    │   Cloudflare Workers/Pages   │   │
│  │  ┌───────────────┐  │    │  ┌────────────────────────┐  │   │
│  │  │  Next.js App   │  │    │  │  Hono API (Edge)       │  │   │
│  │  │  (SSR/SSG/RSC) │  │    │  │  轻量路由 + 认证       │  │   │
│  │  └───────────────┘  │    │  │  Cloudflare Queues      │  │   │
│  │  Vercel Edge Funcs  │    │  │  Cloudflare R2           │  │   │
│  │  AI SDK 流式响应    │    │  └────────────────────────┘  │   │
│  └─────────────────────┘    └──────────────────────────────┘   │
│                                                                 │
│  全球 Edge 节点 · < 50ms 延迟 · 自动扩缩容                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS / SSE / WebSocket
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   Compute Layer (Docker / VPS)                   │
│                                                                 │
│  ┌──────────────────┐  ┌───────────────┐  ┌─────────────────┐ │
│  │  Hono API Server  │  │ Trigger.dev   │  │ Mastra Server   │ │
│  │  (Node.js/Bun)    │  │ v4 Worker     │  │ (AI Agents)     │ │
│  │  完整 oRPC API    │  │ 长时间任务     │  │ MCP Server      │ │
│  │  Mastra Adapter   │  │ AI 工作流     │  │ AG-UI Endpoint  │ │
│  │  Better Auth      │  │ 报表生成      │  │ RAG Pipeline    │ │
│  │  CASL 权限        │  │ 邮件发送      │  │ Evals           │ │
│  └──────────────────┘  └───────────────┘  └─────────────────┘ │
│                                                                 │
│  Docker Compose · 可水平扩展 · 内网通信                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Data Layer                                  │
│                                                                 │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  PostgreSQL       │  │  Redis          │  │  Object Store  │ │
│  │  + pgvector       │  │  (Cache/Queue)  │  │  (R2/S3/Local) │ │
│  │  Neon (Cloud)     │  │  Upstash (Edge) │  │                │ │
│  │  or Self-hosted   │  │  or Self-hosted │  │                │ │
│  └──────────────────┘  └────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 三种部署模式

| 模式 | 适用场景 | 成本/月 |
|------|---------|---------|
| **模式 A：全 Serverless** | MVP / 个人开发 | $5-30 |
| Vercel + Cloudflare + Neon + Upstash + Trigger.dev Cloud | | |
| **模式 B：混合模式** | 小团队生产 | $50-150 |
| Vercel (前端) + Docker VPS (后端/AI) + Neon (DB) | | |
| **模式 C：全 Docker 自托管** | 企业私有部署 | $15-50 (VPS 费用) |
| Cloudflare Pages (前端) + Docker (全部后端) | | |

---

## 十、开发路线图

### Phase 1：工程基座 (2-3 周)
- [ ] Turborepo + pnpm workspace 初始化
- [ ] Hono + oRPC + Scalar UI 搭建
- [ ] Drizzle + PostgreSQL Schema 定义
- [ ] Next.js + shadcn-ui + Tailwind 前端骨架
- [ ] Better Auth 认证接入
- [ ] CASL + RBAC 权限系统
- [ ] Docker Compose 本地开发环境
- [ ] CI/CD 流水线

### Phase 2：传统后台功能 (3-4 周)
- [ ] 用户管理 CRUD
- [ ] 角色 / 权限 / 菜单管理
- [ ] 字典管理
- [ ] 操作日志
- [ ] 系统监控
- [ ] TanStack Table 数据表格封装
- [ ] next-intl 国际化
- [ ] Excel 导出 (excelize-wasm)

### Phase 3：AI 核心集成 (3-4 周)
- [ ] Mastra + Hono Adapter 集成
- [ ] Vercel AI SDK 流式接口
- [ ] 第一个 Agent：Admin Copilot
- [ ] CopilotKit + AG-UI 前端集成
- [ ] assistant-ui 聊天组件
- [ ] RAG 知识库（pgvector + 文档索引）
- [ ] Trigger.dev v4 任务队列
- [ ] MCP Server 暴露后台工具

### Phase 4：AI Native 深度 (3-4 周)
- [ ] 自然语言筛选器（NL → SQL/Filter）
- [ ] Generative UI 组件（AI 动态表格/图表/表单）
- [ ] 智能审批工作流（Human-in-the-Loop）
- [ ] 异常检测 Agent + 告警
- [ ] AI 决策审计日志
- [ ] 数据分析 Agent + 可视化

### Phase 5：反馈学习闭环 (2-3 周)
- [ ] 人工反馈收集机制
- [ ] Mastra Evals 评估系统接入
- [ ] Prompt 版本管理 + A/B 测试
- [ ] AI 可观测性看板（OpenTelemetry）
- [ ] Agent 质量持续监控

### Phase 6：发布优化 (2 周)
- [ ] 性能调优（Edge 缓存、DB 索引）
- [ ] 安全审计（OWASP、Prompt 注入防护）
- [ ] 文档完善
- [ ] 开源发布准备

---

## 十一、关键技术决策记录 (ADR)

| # | 决策 | 理由 |
|---|------|------|
| ADR-001 | oRPC 替代 tRPC | 端到端类型安全 + 一等 OpenAPI 3.1 支持，一举解决内外部 API 需求 |
| ADR-002 | CopilotKit + assistant-ui 双 AI UI 层 | CopilotKit 负责 Agentic 交互（状态同步、工具调用），assistant-ui 负责 Chat UI（流式、Markdown） |
| ADR-003 | AG-UI 作为 Agent-Frontend 协议 | 组件可互换：用 CopilotKit 的 React 组件配合任何 AG-UI 源。后端灵活性：无需 UI 变更即可切换云端和本地模型。多 Agent 协调：通过单一接口编排专用 Agent。 |
| ADR-004 | Mastra 作为 AI Agent 框架 | 无论是模型提供商、网关、工作流运行器、评估、内存还是存储，Mastra 都让你选择最适合你的工具。同样的灵活性也适用于部署。 |
| ADR-005 | Trigger.dev v4 作为任务执行引擎 | 开源可自托管，与 Mastra 有官方集成示例，支持长时间运行的 AI 工作流 |
| ADR-006 | CASL + 自建 RBAC 替代 Casbin | 前后端同构、Edge 兼容、6KB 轻量、TypeScript 原生 |
| ADR-007 | 分层部署（Edge + Compute） | Edge 处理轻量请求（认证/缓存），Compute 处理重型任务（AI/报表） |
| ADR-008 | pgvector 复用 PostgreSQL | 无需额外向量数据库服务，降低运维复杂度和成本 |

---

## 十二、安全架构

| 层级 | 防护措施 |
|------|---------|
| **网络层** | Cloudflare WAF + DDoS 防护 + Hono Rate Limiter |
| **认证层** | Better Auth (OAuth/MFA) + JWT + Secure Cookies |
| **授权层** | CASL RBAC + 行级数据隔离 + API 中间件权限检查 |
| **AI 安全** | Guardrails at the boundary：防止 Prompt 注入，阻止敏感数据泄露，执行品牌和合规准则。 |
| **数据层** | PostgreSQL Row-Level Security + 加密存储 + 审计日志 |
| **传输层** | HTTPS Everywhere + Edge 终端 TLS |

---

> **本文档定义了一个从 Layer 0（工程基础设施）到 Layer 5（反馈学习闭环）的完整 AI Native 后台管理系统架构。它不是在传统后台上「叠加 AI 功能」，而是让 AI 成为系统的核心推理引擎，渗透到每一个用户交互和业务流程中。**
