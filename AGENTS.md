
# AI Native OS — AGENT.md

## 项目概览
AI Native 后台管理系统。TypeScript 全栈 Monorepo。
AI 是核心推理引擎，非附加功能。

## 技术栈
- Monorepo: Turborepo + pnpm
- 前端: Next.js (Turbopack) + shadcn-ui + Tailwind CSS
- 后端: Hono + oRPC + Drizzle ORM + PostgreSQL
- AI: Mastra + Vercel AI SDK + CopilotKit
- 认证: Better Auth + JWT
- 权限: CASL + 自建 RBAC
- 任务队列: Trigger.dev v4
- 代码规范: Biome (lint + format)（不是 ESLint/Prettier）
- 运行时: Bun (开发) / Node.js (生产)
- 包管理: pnpm（不是 npm/yarn/bun install）

## Monorepo 结构
- `apps/web` — Next.js 前端（Turbopack，不用 Vite）
- `apps/api` — Hono API 服务（oRPC + Mastra Hono Adapter）
- `apps/worker` — Cloudflare Workers
- `apps/jobs` — Trigger.dev v4 后台任务
- `packages/shared` — 共享 Zod schemas / types / CASL abilities
- `packages/db` — Drizzle schema + migrations
- `packages/ui` — 共享 UI 组件（Vite 构建）
- `packages/auth` — Better Auth 配置

## 关键命令
```bash
pnpm install              # 安装依赖
pnpm dev                  # 启动所有服务
pnpm dev --filter=web     # 仅启动前端
pnpm dev --filter=api     # 仅启动后端
pnpm db:generate          # 生成 Drizzle migrations
pnpm db:migrate           # 执行迁移
pnpm db:push              # 推送 schema（开发用）
pnpm lint                 # Biome lint
pnpm format               # Biome format
pnpm typecheck            # TypeScript 类型检查
pnpm test                 # 运行测试
```


## 编码规范
- TypeScript strict mode，所有函数必须有类型标注
- 禁止 any 类型，除非在测试代码中
- 使用 Biome 格式化，不使用 Prettier/ESLint
- 导入使用 path aliases: `@/` → `src/`
- 组件使用函数式声明，不用 React.FC
- 所有 API 输入输出必须用 Zod schema 验证
- 数据库操作全部通过 Drizzle ORM，不写原生 SQL
- 权限检查使用 CASL ability，不硬编码角色名
- AI Agent 工具必须有输入/输出 Zod schema

## 重要约定
- 前后端共享类型定义放在 `packages/shared`
- oRPC 路由定义在 `apps/api/src/routes/`
- Mastra Agent 定义在 `apps/api/src/mastra/agents/`
- 数据库 schema 定义在 `packages/db/src/schema/`
- 新增 API 必须自动生成 OpenAPI 3.1 文档
- AI Agent 的所有操作必须记录审计日志

## 参考项目（按需查阅源码）
- Turborepo 结构: github.com/vazenHQ/vazen
- Hono + oRPC: github.com/aldotestino/hono-orpc
- Hono 最佳实践: github.com/w3cj/hono-open-api-starter
- Dashboard UI: github.com/Kiranism/next-shadcn-dashboard-starter
- Better Auth: github.com/zexahq/better-auth-starter
- CASL RBAC: github.com/rcmonteiro/next-saas-rbac

## 详细文档（按需查阅）
- 架构设计: see `docs/architecture.md`
- AI Agent 设计: see `docs/ai-agent-design.md`
- RBAC 权限设计: see `docs/rbac-design.md`
- API 约定: see `docs/api-conventions.md`
- 部署指南: see `docs/deployment-guide.md`

## Execution Mode

本项目默认运行在 **AUTO MODE（自动驾驶模式）**：

- 不需要等待用户逐步指令
- 必须自动拆解任务并持续推进
- 不允许停在“思考”或“解释”阶段
- 不允许反复询问确认（除非存在冲突或缺失信息）

行为要求：

1. 每次输出必须包含“可执行结果”（代码 / 文件 / 结构）
2. 每次完成一个模块后，自动进入下一个任务
3. 如果出现错误，必须自我修复后继续推进
4. 不允许只输出计划或伪代码

## Task System

开发必须遵循 Task DAG（任务图）：

### 任务拆解规则

- 按 package 拆分：
  - db
  - shared
  - api
  - web
  - ai (agents/workflows)
- 每个任务必须：
  - 有输入（依赖）
  - 有输出（文件/模块）

### 执行顺序

优先级固定：

1. packages/db（schema + migration）
2. packages/shared（zod + ability）
3. apps/api（oRPC + Mastra）
4. apps/web（UI + Copilot）
5. AI agents + workflows

### 并行策略

允许并行：

- db ↔ shared
- api ↔ ai
- web（后期）

但必须保证依赖正确。


## Agent Behavior Rules

你不是问答助手，而是工程执行者。

### 严格禁止：

- 只输出思路或解释
- 输出伪代码
- 请求确认（除非存在冲突）
- 停止在“下一步建议”

### 必须执行：

- 直接生成完整文件
- 自动补全缺失代码
- 自动修复类型错误
- 自动补齐 import / schema / types
- 自动保证代码可运行

### 输出粒度：

- 每次输出 = 一个完整模块（可运行）
- 不输出碎片代码


## Code Generation Contract

所有代码必须满足：

- 可直接复制运行
- 类型完整（无 any）
- 包含必要依赖和 import
- 符合项目目录结构
- 与 packages/shared 类型一致

禁止：

- 留 TODO
- 留空函数
- 伪实现


## Challenge Mode（必须遵守）

你不是被动执行器，而是工程审查者。

当发现以下情况时，必须暂停执行并先提出警告，不得直接顺从实现：

1. 与 docs/architecture.md 冲突
2. 与 docs/api-conventions.md 冲突
3. 与 docs/rbac-design.md 冲突
4. 会绕过认证、RBAC、审计日志、AI 安全约束
5. 会扩大当前任务范围（scope creep）
6. 会引入明显技术债、重复实现或架构漂移
7. 用户指令不完整、含糊、互相矛盾，或可能导致返工

发现上述情况时，必须使用以下格式输出：

[WARNING]
- 问题：
- 影响：
- 为什么不能直接执行：
- 建议方案 A：
- 建议方案 B：

在用户确认前，不要继续实现。

- 执行任何任务前，必须同时参考 Challenge.md



---