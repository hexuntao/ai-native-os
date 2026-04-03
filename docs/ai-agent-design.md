
# AI Agent 设计文档

> 本文档定义 AI Native OS 系统中所有 AI Agent、Workflow、Tool、MCP、RAG、Evals 的设计规范和实现标准。

---

## 一、AI 架构总览

### 1.1 五层 AI 架构

```
Layer 5: 反馈学习层 — Evals + Feedback + Prompt Versioning
Layer 4: Agentic 业务流层 — Agent + Workflow + Human-in-the-Loop + MCP
Layer 3: Generative UI 层 — CopilotKit + assistant-ui + AG-UI
Layer 2: 上下文工程层 — RAG + Memory + pgvector + Knowledge Base
Layer 1: LLM 编排层 — Mastra Core + Vercel AI SDK + Model Router
```

### 1.2 技术选型

| 组件 | 技术 | 职责 |
|------|------|------|
| Agent 框架 | Mastra | Agent 定义、Tool 编排、Workflow 引擎 |
| AI SDK | Vercel AI SDK | 流式响应、模型抽象、UI 组件 |
| Generative UI | CopilotKit + assistant-ui | AI 驱动的交互式前端 |
| Agent-UI 协议 | AG-UI | Agent 与前端的实时双向通信 |
| MCP | @mastra/mcp | 暴露后台工具 + 连接外部工具 |
| 向量数据库 | pgvector (PostgreSQL) | RAG 嵌入存储与检索 |
| 任务执行 | Trigger.dev v4 | 长时间运行的 AI 任务 |
| AI 可观测性 | Mastra Tracing + OpenTelemetry | 决策链路追踪 |
| AI 评估 | Mastra Evals | Agent 质量持续评估 |

### 1.3 Mastra + Hono 集成方式

使用 `@mastra/hono` Server Adapter 将 Mastra 实例挂载到 Hono 应用：

```typescript
// apps/api/src/mastra/index.ts
import { Mastra } from '@mastra/core/mastra'
import { adminCopilot } from './agents/admin-copilot'
import { auditAnalyst } from './agents/audit-analyst'
import { getMastraEvalScorerRegistry } from './evals/registry'
import { mastraTools } from './tools'
import { reportSchedule } from './workflows/report-schedule'

const mastraScorers = getMastraEvalScorerRegistry()

export const mastra = new Mastra({
  agents: {
    adminCopilot,
    auditAnalyst,
  },
  scorers: mastraScorers,
  tools: mastraTools,
  workflows: {
    reportSchedule,
  },
})
```

```typescript
// apps/api/src/index.ts
import { Hono } from 'hono'
import { SecureMastraServer } from './mastra/server'
import { mastra } from './mastra'

const app = new Hono()

// 挂载 Mastra 路由，并在 requestContext 中注入统一认证态
const mastraServer = new SecureMastraServer({
  app,
  mastra,
  openapiPath: '/openapi.json',
  prefix: '/mastra',
})

await mastraServer.init()

// 挂载 oRPC 路由
app.route('/api', orpcRouter)

export default app
```

### 1.4 当前运行时覆盖面（2026-04-03）

截至 2026-04-03，仓库实际上线的是“最小安全集（minimum-safe）”，不是本文档中的全量目标矩阵。

| 类型 | 标识符 | 当前状态 | 说明 |
|------|------|------|------|
| Agent | `admin-copilot` | active | 只读后台管理 Copilot，使用受 RBAC 与审计保护的查询类 Tool |
| Agent | `audit-analyst` | active | 只读审计/运维分析 Agent，聚合操作日志与 AI 审计日志 |
| Workflow | `report-schedule` | active | 只读报表快照编排，供 API、Jobs、MCP 统一复用 |
| Agent | `data-analyst` | planned | 仍是目标蓝图，待分析类 Tool、数据脱敏与评估基线进一步补齐后再注册 |
| Agent | `approval-agent` | planned | 仍是目标蓝图，待审批链路、Human-in-the-Loop 与持久化审批状态闭合后再注册 |
| Agent | `anomaly-detector` | planned | 仍是目标蓝图，待高频检测、告警与误报评估基线补齐后再注册 |
| Agent | `report-generator` | planned | 仍是目标蓝图，待导出、通知和模板渲染链路补齐后再注册 |
| Workflow | `approval-flow` | planned | 仍是目标蓝图，依赖 `approval-agent` 与人工审批恢复链路 |
| Workflow | `data-cleanup` | planned | 仍是目标蓝图，待写操作审批与回滚保护收敛后再注册 |
| Workflow | `onboarding` | planned | 当前只保留在架构蓝图中，尚未进入活跃实现范围，也未注册到运行时 |

设计原则：

- 当前运行时只能暴露已经完成 Tool 级 RBAC、AI 审计和最小权限收敛的能力。
- 文档中的目标 Agent / Workflow 蓝图继续保留，但必须明确标注为 `planned`，不能被误读为当前已经注册。
- 后续如果要扩展运行时，必须先补齐对应 Tool、审批、审计、评估与回滚链路，再更新注册表与此表格。

---

## 二、Agent 定义规范

### 2.1 Agent 定义模板

每个 Agent 必须遵循以下结构：

```typescript
// apps/api/src/mastra/agents/[agent-name].ts
import { Agent } from '@mastra/core'
import { z } from 'zod'
import { toolA, toolB } from '../tools'

export const agentName = new Agent({
  // 唯一标识符（kebab-case）
  id: 'agent-name',

  // 使用的模型
  model: {
    provider: 'OPEN_AI',       // 或 ANTHROPIC, GOOGLE 等
    name: 'gpt-4o',
    toolChoice: 'auto',        // auto | required | none
  },

  // Agent 指令（System Prompt）
  instructions: `
    你是 [角色描述]。

    ## 职责
    - [职责 1]
    - [职责 2]

    ## 约束
    - [约束 1]
    - [约束 2]

    ## 输出格式
    - [格式要求]
  `,

  // 可用工具列表
  tools: {
    toolA,
    toolB,
  },

  // 可选：结构化输出 Schema
  outputSchema: z.object({
    result: z.string(),
    confidence: z.number(),
  }),
})
```

### 2.2 目标 Agent 蓝图（当前并未全部注册）

> 当前已注册的运行时清单以“1.4 当前运行时覆盖面”为准。以下内容保留为目标设计蓝图，用于指导后续扩展，不代表这些 Agent 已经在当前仓库注册上线。

#### Agent 1: Admin Copilot（全局管理助手）

```typescript
// apps/api/src/mastra/agents/admin-copilot.ts
import { Agent } from '@mastra/core'
import {
  userManagement,
  permissionQuery,
  dataQuery,
  excelExport,
  notification,
  dictLookup,
  logSearch,
  systemConfig,
} from '../tools'

export const adminCopilot = new Agent({
  id: 'admin-copilot',

  model: {
    provider: 'ANTHROPIC',
    name: 'claude-sonnet-4-20250514',
    toolChoice: 'auto',
  },

  instructions: `
    你是 AI Native OS 系统的智能管理助手。

    ## 职责
    - 理解管理员的自然语言指令并执行后台管理操作
    - 查询和分析系统数据，回答管理员的问题
    - 提供操作建议和风险提示
    - 帮助生成报表和导出数据

    ## 能力范围
    - 用户管理：查询、创建、更新、禁用用户
    - 权限查询：查看角色权限配置
    - 数据查询：执行结构化数据检索
    - 报表导出：生成 Excel 报表
    - 字典查询：查找系统字典数据
    - 日志搜索：语义搜索操作日志
    - 系统配置：读取和更新系统参数
    - 通知发送：发送系统通知和邮件

    ## 约束
    - 所有写操作（创建、更新、删除）必须向用户确认后执行
    - 不得绕过 RBAC 权限检查
    - 敏感操作（如删除用户、修改权限）必须二次确认
    - 所有操作记录到 AI 审计日志

    ## 交互风格
    - 使用用户的语言（中文或英文）回复
    - 操作前简要说明将要执行的操作
    - 操作后汇报结果
    - 发现异常时主动提醒
  `,

  tools: {
    userManagement,
    permissionQuery,
    dataQuery,
    excelExport,
    notification,
    dictLookup,
    logSearch,
    systemConfig,
  },
})
```

#### Agent 2: Data Analyst（数据分析师）

```typescript
// apps/api/src/mastra/agents/data-analyst.ts
import { Agent } from '@mastra/core'
import { dataQuery, chartGenerator, trendAnalysis } from '../tools'

export const dataAnalyst = new Agent({
  id: 'data-analyst',

  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },

  instructions: `
    你是数据分析专家。

    ## 职责
    - 理解自然语言数据查询需求
    - 将自然语言转换为结构化查询
    - 分析数据趋势、异常和模式
    - 生成数据可视化建议
    - 提供数据驱动的决策建议

    ## 输出要求
    - 查询结果必须包含数据来源说明
    - 趋势分析必须包含时间范围和对比基准
    - 异常数据必须标注置信度
    - 建议必须基于数据，不得凭空推测

    ## 安全约束
    - 仅查询当前用户有权访问的数据
    - 不得暴露其他用户的个人隐私信息
    - 聚合查询结果中单个样本数 < 5 时不返回明细
  `,

  tools: {
    dataQuery,
    chartGenerator,
    trendAnalysis,
  },
})
```

#### Agent 3: Approval Agent（智能审批助手）

```typescript
// apps/api/src/mastra/agents/approval-agent.ts
import { Agent } from '@mastra/core'
import {
  policyCheck,
  amountVerify,
  riskScore,
  historyQuery,
} from '../tools'

export const approvalAgent = new Agent({
  id: 'approval-agent',

  model: {
    provider: 'ANTHROPIC',
    name: 'claude-sonnet-4-20250514',
    toolChoice: 'auto',
  },

  instructions: `
    你是智能审批助手。

    ## 职责
    - 自动审查提交的审批申请
    - 检查申请是否符合公司政策
    - 评估风险等级
    - 为人工审批者提供审批建议和风险评分

    ## 审查流程
    1. 验证申请表单完整性
    2. 核对公司政策合规性
    3. 检查金额合理性（对比历史数据）
    4. 计算综合风险评分（0-100）
    5. 给出审批建议（批准/拒绝/需人工审核）

    ## 风险评分规则
    - 0-30: 低风险，建议自动批准
    - 31-60: 中风险，建议人工审核
    - 61-100: 高风险，建议重点关注

    ## 约束
    - 不得自行做出最终审批决定（仅建议）
    - 必须记录完整的推理链路
    - 金额超过设定阈值必须标记为需人工审核
  `,

  tools: {
    policyCheck,
    amountVerify,
    riskScore,
    historyQuery,
  },
})
```

#### Agent 4: Anomaly Detector（异常检测）

```typescript
// apps/api/src/mastra/agents/anomaly-detector.ts
import { Agent } from '@mastra/core'
import {
  logAnalysis,
  userBehaviorAnalysis,
  systemMetrics,
  notification,
} from '../tools'

export const anomalyDetector = new Agent({
  id: 'anomaly-detector',

  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',   // 低成本模型，高频运行
    toolChoice: 'auto',
  },

  instructions: `
    你是系统异常检测 Agent。

    ## 职责
    - 分析系统日志，检测异常模式
    - 监控用户行为，识别可疑活动
    - 检查系统指标，预测潜在问题
    - 异常发现后自动告警

    ## 检测规则
    - 登录异常：同一账号短时间内多地登录、连续失败登录
    - 权限异常：频繁的权限变更、越权访问尝试
    - 数据异常：大量数据导出、批量删除操作
    - 系统异常：响应时间突增、错误率上升、资源使用异常

    ## 告警级别
    - INFO: 记录但不通知
    - WARNING: 通知管理员
    - CRITICAL: 立即通知 + 自动执行防护措施（如临时锁定账号）

    ## 约束
    - CRITICAL 级别的防护措施执行前需记录完整证据链
    - 误报率需低于 5%（通过 Evals 持续监控）
    - 不得访问用户密码等敏感字段
  `,

  tools: {
    logAnalysis,
    userBehaviorAnalysis,
    systemMetrics,
    notification,
  },
})
```

#### Agent 5: Report Generator（报表生成）

```typescript
// apps/api/src/mastra/agents/report-generator.ts
import { Agent } from '@mastra/core'
import {
  dataQuery,
  excelExport,
  emailSend,
  templateRender,
} from '../tools'

export const reportGenerator = new Agent({
  id: 'report-generator',

  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
    toolChoice: 'auto',
  },

  instructions: `
    你是报表生成 Agent。

    ## 职责
    - 根据需求查询数据并生成结构化报表
    - 支持 Excel (.xlsx) 格式导出
    - 支持定时自动生成并邮件发送
    - 智能选择最合适的图表类型

    ## 报表类型
    - 用户统计报表：新增/活跃/流失用户趋势
    - 权限审计报表：权限变更记录汇总
    - 操作日志报表：操作频次/类型分布
    - 系统运行报表：性能指标/错误统计
    - 自定义报表：根据自然语言描述生成

    ## 输出要求
    - Excel 报表必须包含：标题、数据表、汇总行、生成时间
    - 图表必须有标题、坐标轴标签、图例
    - 邮件正文包含报表摘要
  `,

  tools: {
    dataQuery,
    excelExport,
    emailSend,
    templateRender,
  },
})
```

---

## 三、Tool 定义规范

### 3.1 Tool 定义模板

每个 Tool 必须遵循以下结构：

```typescript
// apps/api/src/mastra/tools/[tool-name].ts
import { createTool } from '@mastra/core'
import { z } from 'zod'

export const toolName = createTool({
  // 唯一标识符
  id: 'tool-name',

  // Tool 描述（LLM 用此判断何时调用）
  description: '简洁描述 Tool 的功能和使用场景',

  // 输入 Schema（Zod）
  inputSchema: z.object({
    param1: z.string().describe('参数 1 的含义'),
    param2: z.number().optional().describe('可选参数 2'),
  }),

  // 输出 Schema（可选，用于类型安全）
  outputSchema: z.object({
    result: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),

  // 执行函数
  execute: async ({ context }) => {
    // 1. 权限检查
    // 2. 执行操作
    // 3. 记录审计日志
    // 4. 返回结果

    return {
      result: 'success',
      metadata: {},
    }
  },
})
```

### 3.2 核心 Tool 清单

```
apps/api/src/mastra/tools/
├── user-management.ts        # 用户 CRUD
│   ├── listUsers             # 查询用户列表（支持筛选、分页）
│   ├── getUser               # 获取单个用户详情
│   ├── createUser            # 创建用户
│   ├── updateUser            # 更新用户信息
│   └── toggleUserStatus      # 启用/禁用用户
│
├── permission-query.ts       # 权限查询
│   ├── getUserPermissions    # 获取用户权限列表
│   ├── getRolePermissions    # 获取角色权限列表
│   └── checkPermission       # 检查特定权限
│
├── data-query.ts             # 通用数据查询
│   ├── queryByNaturalLang    # 自然语言 → 结构化查询
│   ├── aggregateData         # 数据聚合统计
│   └── compareData           # 数据对比分析
│
├── excel-export.ts           # Excel 导出
│   └── generateExcel         # 根据数据生成 .xlsx 文件
│
├── notification.ts           # 通知
│   ├── sendInApp             # 发送站内通知
│   └── sendEmail             # 发送邮件通知（Resend）
│
├── dict-lookup.ts            # 字典查询
│   └── lookupDict            # 查询字典值
│
├── log-search.ts             # 日志搜索
│   ├── searchLogs            # 关键词搜索日志
│   └── semanticSearchLogs    # 语义搜索日志（RAG）
│
├── system-config.ts          # 系统配置
│   ├── getConfig             # 读取配置
│   └── updateConfig          # 更新配置
│
├── chart-generator.ts        # 图表生成
│   └── generateChartData     # 生成前端图表所需数据结构
│
├── trend-analysis.ts         # 趋势分析
│   └── analyzeTrend          # 时序数据趋势分析
│
├── policy-check.ts           # 政策合规检查
│   └── checkPolicy           # 检查操作是否符合企业政策
│
├── risk-score.ts             # 风险评分
│   └── calculateRisk         # 计算综合风险分数
│
└── template-render.ts        # 模板渲染
    └── renderTemplate        # 渲染报表/邮件模板
```

### 3.3 Tool 中的权限检查与审计日志

**每个写操作 Tool 必须包含权限检查和审计日志**：

```typescript
export const createUserTool = createTool({
  id: 'create-user',
  description: '创建新用户',
  inputSchema: createUserSchema,

  execute: async ({ context, mastra }) => {
    // 1. 从 Agent 上下文获取当前操作者信息
    const operator = context.operatorId
    const ability = await buildAbility(operator)

    // 2. CASL 权限检查
    if (!ability.can('create', 'User')) {
      return { error: '权限不足：无法创建用户' }
    }

    // 3. 执行操作
    const user = await db.insert(users).values(context).returning()

    // 4. 记录 AI 审计日志
    await db.insert(aiAuditLogs).values({
      agentId: 'admin-copilot',
      action: 'create-user',
      input: JSON.stringify(context),
      output: JSON.stringify(user),
      operatorId: operator,
      traceId: mastra.traceId,
      createdAt: new Date(),
    })

    return { result: user, message: `用户 ${user.name} 创建成功` }
  },
})
```

---

## 四、Workflow 定义规范

> 当前已注册的 Workflow 仅有 `report-schedule`。下方 `approval-flow` 示例保留为目标蓝图，用于说明未来的 Human-in-the-Loop 编排方式，不代表当前运行时已经暴露该 Workflow。

### 4.1 Workflow 定义模板

```typescript
// apps/api/src/mastra/workflows/[workflow-name].ts
import { Workflow, Step } from '@mastra/core'
import { z } from 'zod'

const step1 = new Step({
  id: 'step-1',
  inputSchema: z.object({ /* ... */ }),
  outputSchema: z.object({ /* ... */ }),
  execute: async ({ context, suspend }) => {
    // 如需人工审批：
    // const approval = await suspend({ reason: '需要主管审批' })
    // if (!approval.approved) return { status: 'rejected' }

    return { status: 'completed', data: {} }
  },
})

export const workflowName = new Workflow({
  name: 'workflow-name',
  triggerSchema: z.object({ /* 触发输入 */ }),
})
  .step(step1)
  .then(step2)
  .branch([
    [async ({ context }) => context.risk === 'low', lowRiskStep],
    [async ({ context }) => context.risk === 'high', highRiskStep],
  ])
  .after([lowRiskStep, highRiskStep])
  .step(finalStep)
  .commit()
```

### 4.2 智能审批工作流（完整示例）

```typescript
// apps/api/src/mastra/workflows/approval-flow.ts
import { Workflow, Step } from '@mastra/core'
import { z } from 'zod'
import { approvalAgent } from '../agents/approval-agent'

// Step 1: AI 自动审查
const aiReviewStep = new Step({
  id: 'ai-review',
  inputSchema: z.object({
    applicantId: z.string(),
    type: z.enum(['expense', 'leave', 'permission']),
    amount: z.number().optional(),
    description: z.string(),
    attachments: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    riskScore: z.number(),
    riskLevel: z.enum(['low', 'medium', 'high']),
    policyViolations: z.array(z.string()),
    recommendation: z.enum(['approve', 'reject', 'manual_review']),
    reasoning: z.string(),
  }),
  execute: async ({ context }) => {
    // 调用 Approval Agent 进行审查
    const result = await approvalAgent.generate(
      `审查以下${context.type}申请：
       申请人: ${context.applicantId}
       金额: ${context.amount}
       说明: ${context.description}
       请进行政策合规检查、金额合理性验证和风险评估。`,
    )
    return result.object
  },
})

// Step 2a: 自动批准（低风险）
const autoApproveStep = new Step({
  id: 'auto-approve',
  execute: async ({ context }) => {
    await db.update(approvals)
      .set({ status: 'approved', approvedBy: 'ai-agent' })
      .where(eq(approvals.id, context.approvalId))

    return { status: 'approved', method: 'auto' }
  },
})

// Step 2b: 人工审批（高风险）— Human-in-the-Loop
const manualReviewStep = new Step({
  id: 'manual-review',
  execute: async ({ context, suspend }) => {
    // 发送通知给审批者
    await sendNotification({
      to: context.reviewerId,
      title: '待审批申请',
      body: `风险评分: ${context.riskScore}，AI 建议: ${context.recommendation}`,
    })

    // 暂停工作流，等待人工审批
    const humanDecision = await suspend({
      type: 'approval',
      approvalId: context.approvalId,
      riskScore: context.riskScore,
      aiRecommendation: context.recommendation,
      aiReasoning: context.reasoning,
    })

    // 人工决策结果
    return {
      status: humanDecision.approved ? 'approved' : 'rejected',
      method: 'manual',
      reviewerId: humanDecision.reviewerId,
      reviewComment: humanDecision.comment,
    }
  },
})

// Step 3: 后处理
const postProcessStep = new Step({
  id: 'post-process',
  execute: async ({ context }) => {
    // 并行执行
    await Promise.all([
      // 记录审计日志
      recordAuditLog(context),
      // 更新看板数据
      updateDashboard(context),
      // 发送通知给申请人
      notifyApplicant(context),
      // 收集反馈数据（用于 AI 学习）
      collectFeedback(context),
    ])
    return { status: 'completed' }
  },
})

// 组装工作流
export const approvalFlow = new Workflow({
  name: 'approval-flow',
  triggerSchema: z.object({
    applicantId: z.string(),
    type: z.enum(['expense', 'leave', 'permission']),
    amount: z.number().optional(),
    description: z.string(),
    attachments: z.array(z.string()).optional(),
  }),
})
  .step(aiReviewStep)
  .branch([
    // 低风险 → 自动批准
    [
      async ({ context }) => {
        const review = context.getStepResult('ai-review')
        return review.riskLevel === 'low' && review.policyViolations.length === 0
      },
      autoApproveStep,
    ],
    // 中/高风险 → 人工审批
    [
      async ({ context }) => {
        const review = context.getStepResult('ai-review')
        return review.riskLevel !== 'low' || review.policyViolations.length > 0
      },
      manualReviewStep,
    ],
  ])
  .after([autoApproveStep, manualReviewStep])
  .step(postProcessStep)
  .commit()
```

### 4.3 Human-in-the-Loop 前端集成

当工作流暂停等待人工审批时，前端需要：

```typescript
// apps/web 中的审批页面
// 1. 查询待审批列表（包含 AI 建议）
const pendingApprovals = await orpc.approval.listPending.query()

// 2. 展示 AI 审查结果
// - riskScore 可视化（仪表盘）
// - aiRecommendation 高亮显示
// - aiReasoning 展开查看

// 3. 人工决策后恢复工作流
await orpc.approval.resolve.mutate({
  approvalId: 'xxx',
  approved: true,
  comment: '金额合理，批准',
})

// 4. 后端调用 workflow.resume() 恢复暂停的工作流
```

---

## 五、MCP Server 设计

### 5.1 暴露后台管理工具

```typescript
// apps/api/src/mastra/mcp/server.ts
import { MCPServer } from '@mastra/mcp'
import { mastra } from '../index'

export const mcpServer = new MCPServer({
  name: 'ai-native-os',
  version: '1.0.0',
  description: 'AI Native OS 后台管理 MCP Server',

  // 自动暴露所有 Agent（转为 ask_xxx 工具）
  // 自动暴露所有 Workflow（转为 run_xxx 工具）
  // 自动暴露所有 Tool

  // 额外资源
  resources: {
    'system-status': {
      description: '系统运行状态',
      fetch: async () => ({ cpu: '...', memory: '...', uptime: '...' }),
    },
    'user-stats': {
      description: '用户统计数据',
      fetch: async () => ({ total: 1000, active: 800, new: 50 }),
    },
  },

  // Prompt 模板
  prompts: {
    'system-report': {
      description: '生成系统运行报告',
      template: '请基于以下系统数据生成运行报告：{{data}}',
    },
  },
})
```

### 5.2 连接外部 MCP 工具

```typescript
// apps/api/src/mastra/mcp/client.ts
import { MCPClient } from '@mastra/mcp'

export const mcpClient = new MCPClient({
  servers: {
    // 连接本地文件系统 MCP
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/data'],
    },
    // 连接远程 MCP 服务
    externalApi: {
      url: 'https://api.example.com/mcp',
      headers: { Authorization: `Bearer ${process.env.MCP_TOKEN}` },
    },
  },
})
```

---

## 六、RAG 知识库设计

### 6.1 知识库架构

```
知识来源 → 文档分块 → 嵌入生成 → pgvector 存储 → 语义检索 → Agent 使用
```

### 6.2 文档索引流程

```typescript
// apps/jobs/src/trigger/ai-tasks/rag-indexing.ts
import { task } from '@trigger.dev/sdk/v3'
import { mastra } from '../../mastra'

export const ragIndexingTask = task({
  id: 'rag-indexing',
  run: async ({ documentId, content, metadata }) => {
    // 1. 文档分块
    const chunks = await mastra.rag.chunk(content, {
      strategy: 'recursive',
      chunkSize: 512,
      chunkOverlap: 50,
    })

    // 2. 生成嵌入
    const embeddings = await mastra.rag.embed(chunks, {
      model: 'text-embedding-3-small',
    })

    // 3. 存储到 pgvector
    await mastra.vectors.pgVector.upsert({
      indexName: 'knowledge-base',
      vectors: embeddings.map((embedding, i) => ({
        id: `${documentId}-${i}`,
        vector: embedding,
        metadata: {
          documentId,
          chunkIndex: i,
          content: chunks[i],
          ...metadata,
        },
      })),
    })
  },
})
```

### 6.3 语义检索

```typescript
// Agent Tool 中使用 RAG
export const semanticSearchLogsTool = createTool({
  id: 'semantic-search-logs',
  description: '使用语义搜索查找操作日志',
  inputSchema: z.object({
    query: z.string().describe('搜索查询（自然语言）'),
    limit: z.number().default(10),
  }),
  execute: async ({ context }) => {
    const results = await mastra.vectors.pgVector.query({
      indexName: 'operation-logs',
      queryVector: await mastra.rag.embed(context.query),
      topK: context.limit,
      filter: { /* 可选元数据过滤 */ },
    })
    return { results }
  },
})
```

---

## 七、Generative UI 集成

### 7.1 CopilotKit 后端配置

```typescript
// apps/api/src/copilotkit/chat-route.ts
import { registerCopilotKit } from '@ag-ui/mastra'
import { mastra } from '../mastra'

export const copilotKitRoute = registerCopilotKit({
  mastra,
  agentId: 'admin-copilot',      // 默认使用的 Agent
  // CopilotKit 可选配置
  options: {
    emitStateUpdates: true,       // 发送状态更新事件
    emitToolCalls: true,          // 发送工具调用事件
  },
})
```

### 7.2 CopilotKit 前端集成

```typescript
// apps/web/app/(dashboard)/layout.tsx
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotSidebar } from '@copilotkit/react-ui'

export default function DashboardLayout({ children }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-1">{children}</main>
        <CopilotSidebar
          labels={{
            title: 'AI 管理助手',
            placeholder: '有什么可以帮你的？',
          }}
        />
      </div>
    </CopilotKit>
  )
}
```

### 7.3 Generative UI 组件

```typescript
// apps/web/components/copilot/generative-table.tsx
import { useCopilotAction } from '@copilotkit/react-core'

// 注册前端 Action：AI 可以在聊天中渲染数据表格
useCopilotAction({
  name: 'renderDataTable',
  description: '在界面中渲染数据表格',
  parameters: [
    { name: 'title', type: 'string' },
    { name: 'columns', type: 'object[]' },
    { name: 'data', type: 'object[]' },
  ],
  render: ({ args }) => (
    <DataTable
      title={args.title}
      columns={args.columns}
      data={args.data}
    />
  ),
})
```

---

## 八、反馈学习层

### 8.1 AI 决策审计日志

所有 Agent 操作自动记录，包含：
- Agent ID + 工具 ID
- 输入 / 输出
- 推理链路（reasoning chain）
- 置信度（confidence）
- Token 消耗 + 延迟
- OpenTelemetry trace ID
- 操作者 ID
- 是否被人工覆盖

### 8.2 反馈收集

当用户拒绝或修改 AI 建议时自动收集：

```typescript
// 前端：用户操作 AI 建议后触发
async function onAiSuggestionResponse(params: {
  auditLogId: string
  accepted: boolean
  correction?: string
  feedbackText?: string
}) {
  await orpc.ai.feedback.create.mutate(params)
}
```

### 8.3 Mastra Evals 配置

```typescript
// apps/api/src/mastra/evals/experiments.ts
import { Dataset, Experiment } from '@mastra/core'
import { adminCopilot } from '../agents/admin-copilot'
import { completenessScorer, accuracyScorer, safetyScorer } from './scorers'

// 评估数据集
export const copilotDataset = new Dataset({
  name: 'admin-copilot-eval',
  schema: z.object({
    query: z.string(),
    expectedAction: z.string(),
    expectedResult: z.string(),
  }),
  items: [
    {
      query: '显示本月新增用户数',
      expectedAction: 'dataQuery',
      expectedResult: '包含用户数的数据结果',
    },
    // ...更多评估项
  ],
})

// 评估实验
export const copilotExperiment = new Experiment({
  name: 'copilot-v1',
  dataset: copilotDataset,
  agent: adminCopilot,
  scorers: [completenessScorer, accuracyScorer, safetyScorer],
  // 定期运行（通过 Trigger.dev 调度）
})
```

### 8.4 Prompt 版本管理

```sql
-- ai_prompt_versions 表
-- 每次修改 Agent instructions 时创建新版本
-- is_active 标记当前生效版本
-- scoring_results 存储该版本的 Eval 评分

-- 版本切换流程：
-- 1. 创建新版本（is_active = false）
-- 2. 运行 Eval（对比新旧版本评分）
-- 3. 新版本评分更优 → 切换 is_active
-- 4. 保留旧版本用于回滚
```

---

## 九、AI 安全防护

### 9.1 Prompt 注入防护

```typescript
// 所有用户输入在传递给 Agent 前进行清洗
function sanitizeUserInput(input: string): string {
  // 移除常见注入模式
  // 但不过度清洗（保留正常自然语言）
  return input
    .replace(/ignore previous instructions/gi, '[FILTERED]')
    .replace(/system prompt/gi, '[FILTERED]')
    .replace(/you are now/gi, '[FILTERED]')
}
```

### 9.2 输出过滤

```typescript
// Agent 输出在返回给用户前检查
function filterAgentOutput(output: string): string {
  // 检查是否包含敏感信息（密码、密钥、内部 ID）
  // 检查是否包含不当内容
  return output
}
```

### 9.3 工具调用限制

```typescript
// 每个工具设置调用频率限制
const toolRateLimits = {
  'create-user': { maxPerMinute: 10 },
  'delete-user': { maxPerMinute: 5 },
  'update-config': { maxPerMinute: 3 },
  'data-query': { maxPerMinute: 30 },
}
```
