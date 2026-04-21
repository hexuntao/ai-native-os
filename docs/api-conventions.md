# API 约定文档

> 本文档定义 AI Native OS 当前公开 API contract 的设计规范、命名约定、错误结构与文档一致性规则。

---

## 一、API 架构总览

### 1.1 双通道 API 架构

```
┌─────────────────────────────────────────────────┐
│                 Hono API Server                  │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────────┐ │
│  │   oRPC 通道       │  │   Mastra 通道        │ │
│  │                   │  │                      │ │
│  │ /api/v1/*         │  │ /mastra/*            │ │
│  │ 业务与治理 API     │  │ AI Agent / Workflow  │ │
│  │ 端到端类型安全     │  │ MCP / Runtime 端点   │ │
│  │ 自动 OpenAPI 文档  │  │ 流式与工具编排       │ │
│  └──────────────────┘  └──────────────────────┘ │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │           共享中间件                       │   │
│  │  Auth · Permission · RateLimit · Logger   │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 1.2 当前 URL 路径规范

```
/api/v1/system/users              # 系统管理 - 用户
/api/v1/system/roles              # 系统管理 - 角色
/api/v1/system/permissions        # 系统管理 - 权限
/api/v1/system/menus              # 系统管理 - 菜单
/api/v1/system/dicts              # 系统管理 - 字典（内置项只读，自定义项可写）
/api/v1/system/config             # 系统管理 - 配置（内置项只读，自定义项可写）
/api/v1/system/session            # 系统 - 当前会话
/api/v1/system/rbac-summary       # 系统 - RBAC 摘要
/api/v1/system/permission-admin-check # 系统 - 权限管理入口校验
/api/v1/system/users/principal-repair* # 系统 - 历史主体修复

/api/v1/monitor/logs              # 监控 - 操作日志
/api/v1/monitor/online            # 监控 - 在线主体
/api/v1/monitor/server            # 监控 - 服务/依赖摘要

/api/v1/ai/knowledge              # AI - 知识库
/api/v1/ai/evals                  # AI - 评测数据与执行
/api/v1/ai/audit                  # AI - 审计日志
/api/v1/ai/feedback               # AI - 反馈
/api/v1/ai/prompts                # AI - Prompt 版本与治理命令
/api/v1/ai/governance/*           # AI - 治理综览与审核面

/api/v1/tools/gen                 # 工具 - 生成器目录
/api/v1/tools/jobs                # 工具 - 任务目录

/mastra/agents/*                  # Mastra Agent 端点
/mastra/workflows/*               # Mastra Workflow 端点
/mastra/mcp/*                     # MCP Server 端点
/api/copilotkit                   # CopilotKit / AG-UI 端点

/api/auth/*                       # Better Auth 端点
/api/docs                         # Scalar UI（OpenAPI 文档）
/api/openapi.json                 # OpenAPI 3.1 JSON
```

约束说明：

- `/api/v1/*` 是 contract-first 公开业务面。
- `/mastra/*`、`/api/copilotkit`、`/api/ag-ui/*` 属于 AI runtime / streaming 面，不按 CRUD 资源面理解。
- 文档中的示例路径必须与当前公开 contract 保持一致；未公开的内部 helper 不得写入“标准模板”。

---

## 二、oRPC 路由规范

### 2.1 路由定义结构

当前实现使用聚合式 `appRouter` 暴露 contract-first 路由面：

```typescript
// apps/api/src/routes/index.ts
export const appRouter = {
  ai: {
    audit: {
      getById: aiAuditGetByIdProcedure,
      list: aiAuditListProcedure,
    },
    evals: {
      getById: aiEvalsGetByIdProcedure,
      list: aiEvalsListProcedure,
      run: aiEvalsRunProcedure,
      runDetail: aiEvalsRunDetailProcedure,
    },
    feedback: {
      create: aiFeedbackCreateProcedure,
      getById: aiFeedbackGetByIdProcedure,
      list: aiFeedbackListProcedure,
    },
    governance: {
      overview: aiGovernanceOverviewProcedure,
      promptReview: aiPromptGovernanceReviewProcedure,
    },
    knowledge: {
      create: aiKnowledgeCreateProcedure,
      delete: aiKnowledgeDeleteProcedure,
      getById: aiKnowledgeGetByIdProcedure,
      list: aiKnowledgeListProcedure,
      update: aiKnowledgeUpdateProcedure,
    },
    prompts: {
      activate: aiPromptsActivateProcedure,
      'attach-evidence': aiPromptsAttachEvidenceProcedure,
      compare: aiPromptsCompareProcedure,
      create: aiPromptsCreateProcedure,
      failureAudit: aiPromptsFailureAuditProcedure,
      getById: aiPromptsGetByIdProcedure,
      history: aiPromptsHistoryProcedure,
      list: aiPromptsListProcedure,
      releaseAudit: aiPromptsReleaseAuditProcedure,
      rollback: aiPromptsRollbackProcedure,
      rollbackChain: aiPromptsRollbackChainProcedure,
    },
  },
  monitor: {
    logs: monitorLogsListProcedure,
    online: monitorOnlineListProcedure,
    server: monitorServerSummaryProcedure,
  },
  system: {
    config: {
      create: configCreateProcedure,
      delete: configDeleteProcedure,
      getById: configGetByIdProcedure,
      list: configListProcedure,
      update: configUpdateProcedure,
    },
    dicts: {
      create: dictsCreateProcedure,
      delete: dictsDeleteProcedure,
      getById: dictsGetByIdProcedure,
      list: dictsListProcedure,
      update: dictsUpdateProcedure,
    },
    menus: {
      create: menusCreateProcedure,
      delete: menusDeleteProcedure,
      getById: menusGetByIdProcedure,
      list: menusListProcedure,
      update: menusUpdateProcedure,
    },
    permissions: {
      audit: permissionsAuditProcedure,
      create: permissionsCreateProcedure,
      delete: permissionsDeleteProcedure,
      getById: permissionsGetByIdProcedure,
      impact: permissionsImpactProcedure,
      list: permissionsListProcedure,
      update: permissionsUpdateProcedure,
    },
    roles: {
      create: rolesCreateProcedure,
      delete: rolesDeleteProcedure,
      getById: rolesGetByIdProcedure,
      list: rolesListProcedure,
      update: rolesUpdateProcedure,
    },
    users: {
      create: usersCreateProcedure,
      delete: usersDeleteProcedure,
      getById: usersGetByIdProcedure,
      list: usersListProcedure,
      'principal-repair': usersPrincipalRepairProcedure,
      'principal-repair-candidates': usersPrincipalRepairCandidatesProcedure,
      update: usersUpdateProcedure,
    },
  },
  tools: {
    gen: toolGenListProcedure,
    jobs: toolJobsListProcedure,
  },
}
```

### 2.2 基础资源 CRUD 模板（必选）

所有“资源型管理模块”必须优先满足以下最小 contract：

```typescript
const resourceRouter = {
  list: os.input(listSchema).handler(...),       // GET    /resources
  getById: os.input(idSchema).handler(...),      // GET    /resources/:id
  create: os.input(createSchema).handler(...),   // POST   /resources
  update: os.input(updateSchema).handler(...),   // PUT    /resources/:id
  delete: os.input(idSchema).handler(...),       // DELETE /resources/:id
}
```

适用范围：

- `system/users`
- `system/roles`
- `system/permissions`
- `system/menus`
- `system/config`
- `system/dicts`
- `ai/knowledge`

约束说明：

- `list / getById / create / update / delete` 是资源型 API 的基础质量门。
- 若资源存在内置只读项、种子项、运行时虚拟项，可以通过业务约束拒绝写入，但 contract 仍按 CRUD 公开。
- 不得把“当前未实现的扩展命令”写进通用模板。

### 2.3 扩展命令路由（按需，不作为通用要求）

以下路由模式属于“按资源特性扩展”，不是所有模块都必须具备：

```typescript
const governanceRouter = {
  run: os.input(runSchema).handler(...),                // POST /resources/run
  activate: os.input(activateSchema).handler(...),      // POST /resources/:id/activate
  rollback: os.input(rollbackSchema).handler(...),      // POST /resources/:id/rollback
  compare: os.input(compareSchema).handler(...),        // GET  /resources/:id/compare/:baselineId
  history: os.input(historySchema).handler(...),        // GET  /resources/history/:key
  impact: os.input(impactSchema).handler(...),          // GET  /resources/:id/impact
  audit: os.input(auditSchema).handler(...),            // GET  /resources/:id/audit
  overview: os.input(overviewSchema).handler(...),      // GET  /resources/overview
}
```

典型示例：

- `ai/evals.run`
- `ai/prompts.activate`
- `ai/prompts.rollback`
- `ai/prompts.compare`
- `ai/prompts.history`
- `system/permissions.impact`
- `system/permissions.audit`
- `ai/governance.overview`

说明：

- `batchDelete / export / import` 不是当前仓库的通用必选合同。
- 如果后续某个资源面真正需要这些能力，必须在资源级文档里显式声明，并补对应 OpenAPI 与契约测试。

### 2.4 当前公开 contract 映射

| 资源族 | 当前 contract 形态 | 说明 |
|------|------|------|
| `system/users` | 完整 CRUD | 用户目录资源面 |
| `system/roles` | 完整 CRUD | 角色资源面 |
| `system/permissions` | CRUD + `impact` + `audit` | 权限资源面 + 治理检查 |
| `system/menus` | 完整 CRUD | 菜单资源面 |
| `system/config` | 完整 CRUD | 自定义配置可写，内置配置只读 |
| `system/dicts` | 完整 CRUD | 自定义字典可写，内置字典只读 |
| `system/session` | helper read | 当前登录会话摘要 |
| `system/rbac-summary` | helper read | RBAC 聚合摘要 |
| `system/permission-admin-check` | helper read | 权限管理入口校验 |
| `system/users/principal-repair*` | operator command | 历史主体修复命令面 |
| `monitor/logs` | read list | 监控/审计只读面 |
| `monitor/online` | read list | 在线主体只读面 |
| `monitor/server` | read summary | 服务与依赖摘要 |
| `ai/knowledge` | 完整 CRUD | 知识库文档级资源面 |
| `ai/evals` | list + getById + run + runDetail | 评测资源面 + 执行命令 |
| `ai/audit` | list + getById | AI 审计只读面 |
| `ai/feedback` | list + getById + create | 反馈资源面 |
| `ai/prompts` | list + getById + create + governance commands | Prompt 版本与治理面 |
| `ai/governance/*` | read models | Prompt 治理综览与审核面 |
| `tools/gen` | read list | 工具目录面 |
| `tools/jobs` | read list | 任务目录面 |

---

## 三、Zod Schema 规范

### 3.1 Schema 文件位置

所有 Zod Schema 定义在 `packages/shared/src/schemas/` 中，前后端共享。

### 3.2 命名约定

```typescript
export const userEntrySchema = z.object({ ... })
export const createUserInputSchema = z.object({ ... })
export const updateUserInputSchema = z.object({ ... })
export const getUserByIdInputSchema = z.object({ id: z.string().uuid() })
export const listUsersInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.boolean().optional(),
})
export const userListResponseSchema = paginatedResponseSchema(userEntrySchema)
```

约束说明：

- 输入 schema 使用 `*InputSchema` 后缀。
- 单条资源输出使用 `*EntrySchema` 或 `*DetailSchema`。
- 分页列表统一使用 `*ListResponseSchema`。
- 所有公开 schema 必须补中文字段说明、必要示例和 OpenAPI 元数据。

### 3.3 通用分页 Schema

```typescript
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
})

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  })
```

---

## 四、错误处理规范

### 4.1 统一错误载荷

当前 REST 兼容入口统一输出以下错误结构：

```typescript
{
  code: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'RATE_LIMITED' | ...,
  errorCode: 40000 | 40100 | 40300 | 40400 | 42900 | ...,
  message: string,
  requestId?: string,
  status: number,
}
```

参数校验错误在此基础上额外返回：

```typescript
{
  code: 'BAD_REQUEST',
  errorCode: 40000,
  message: 'Invalid request payload',
  requestId?: string,
  status: 400,
  issues: {
    fieldErrors: Record<string, string[]>,
    formErrors: string[],
  },
}
```

限流错误在此基础上额外返回：

```typescript
{
  code: 'RATE_LIMITED',
  errorCode: 42900,
  message: '请求过于频繁',
  requestId?: string,
  status: 429,
  retryAfterSeconds: number,
}
```

### 4.2 错误码定义

错误码定义以 [packages/shared/src/constants/error-codes.ts](/Users/tao/work/ai/ai-native-os/packages/shared/src/constants/error-codes.ts) 为单一事实来源。

约束说明：

- 不允许在路由里发明未登记的公开错误码。
- 新增领域错误码时，必须同时更新 shared constant、OpenAPI 示例和契约测试。
- 前端不得依赖自然语言 `message` 做核心分支判断。

---

## 五、中间件链

### 5.1 标准中间件顺序

当前 API 入口遵循以下顺序：

```typescript
const app = new Hono()

app.use('*', secureHeaders())
app.use('*', cors(...))
app.use('*', requestId())
app.use('/api/*', createApiRateLimitMiddleware(...))
app.onError(...)

// 公开 runtime / auth / docs 路由
app.get('/health', ...)
app.all('/api/auth/*', ...)
app.get('/api/docs', ...)
app.get('/api/openapi.json', ...)
app.all('/mastra/mcp/*', ...)
app.all('/api/copilotkit', ...)

// 业务 contract 路由
app.use('/api/v1/*', authSessionMiddleware)
app.use('/api/v1/*', rpcHandler)
```

约束说明：

- `Auth · Permission · RateLimit · Logger` 是公开文档中的共享基线。
- `/health` 默认为限流豁免，避免影响 readiness / liveness。
- `/api/v1/*` 必须在统一认证上下文下运行。

---

## 六、OpenAPI 文档规范

### 6.1 OpenAPI 生成原则

- `oRPC + Zod` 是 OpenAPI 3.1 的唯一公开 contract 来源。
- Scalar 只渲染当前已公开的 contract，不展示未开放的内部 helper。
- 路由级 `summary / description` 与字段级 schema 文档必须为中文业务语义。

### 6.2 文档分组约定

OpenAPI Tag 与路由前缀对应：

| Tag | 路径前缀 | 说明 |
|-----|---------|------|
| `System:Users` | `/api/v1/system/users` | 用户管理 |
| `System:Roles` | `/api/v1/system/roles` | 角色管理 |
| `System:Permissions` | `/api/v1/system/permissions` | 权限管理 |
| `System:Menus` | `/api/v1/system/menus` | 菜单管理 |
| `System:Dicts` | `/api/v1/system/dicts` | 字典管理 |
| `System:Config` | `/api/v1/system/config` | 系统配置 |
| `Monitor:Logs` | `/api/v1/monitor/logs` | 操作日志 |
| `Monitor:Online` | `/api/v1/monitor/online` | 在线主体 |
| `Monitor:Server` | `/api/v1/monitor/server` | 服务监控 |
| `AI:Knowledge` | `/api/v1/ai/knowledge` | 知识库 |
| `AI:Evals` | `/api/v1/ai/evals` | AI 评测 |
| `AI:Audit` | `/api/v1/ai/audit` | AI 审计 |
| `AI:Feedback` | `/api/v1/ai/feedback` | AI 反馈 |
| `AI:Prompts` | `/api/v1/ai/prompts` | Prompt 治理 |
| `AI:Governance` | `/api/v1/ai/governance/*` | Prompt 治理综览 |
| `Tools:Gen` | `/api/v1/tools/gen` | 生成器目录 |
| `Tools:Jobs` | `/api/v1/tools/jobs` | 任务目录 |

---

## 七、文档一致性规则

### 7.1 单一事实来源

- 真实公开 contract 以 `apps/api/src/routes/index.ts` 与 `apps/api/src/index.ts` 为准。
- 本文档负责解释“哪些模式是通用要求，哪些模式是按需扩展”。
- 若实现面与本文档冲突，必须优先修正文档或补充实现，不能长期双轨。

### 7.2 禁止事项

- 不得把未实现的 `batchDelete / export / import` 写成所有资源的通用必选能力。
- 不得把 runtime helper、内部中间态或测试专用入口写进公开 contract 映射。
- 不得在文档里把 AI runtime 命令面误写成通用 CRUD 资源。

### 7.3 变更要求

新增或调整公开 API 时，必须同时完成：

1. 更新 route 与 shared schema
2. 更新 OpenAPI 元数据
3. 更新本文档中的 contract 映射或规则
4. 补契约测试，防止后续漂移
