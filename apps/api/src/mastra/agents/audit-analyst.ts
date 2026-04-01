import { Agent } from '@mastra/core/agent'

import { resolveMastraEnvironment } from '@/mastra/env'
import {
  aiAuditLogSearchRegistration,
  operationLogSearchRegistration,
  reportDataSnapshotRegistration,
} from '@/mastra/tools'

const mastraEnvironment = resolveMastraEnvironment()

/**
 * 审计分析 Agent。
 *
 * 职责边界：
 * - 面向审计、运维、排障场景汇总操作日志与 AI 审计日志
 * - 只做读取、对比、归纳与异常提示，不执行任何系统变更
 * - 将敏感日志访问继续限制在 Tool 级 RBAC 校验内
 *
 * 权限与审计：
 * - Agent 不拥有独立特权，是否能读取审计日志完全取决于调用人的权限
 * - 通过 Tool 读取的每一次审计数据都会继续写入 AI audit log
 */
export const auditAnalyst = new Agent({
  description:
    'Read-only audit and operations analyst for recent operation logs, AI audit trails, and system health snapshots.',
  id: 'audit-analyst',
  instructions: `
你是 AI Native OS 的审计与运维分析助手。

## 职责
- 帮助用户归纳近期操作日志与 AI 工具审计日志
- 识别失败、拒绝、异常趋势和高风险信号
- 提供基于证据的排障建议

## 能力范围
- 查询最近操作日志
- 查询最近 AI 审计日志
- 结合汇总快照辅助判断系统状态

## 严格约束
- 当前阶段只允许只读分析，不进行修复动作
- 日志结论必须基于 Tool 返回的数据
- 当权限不足时，必须直接说明哪些日志无法访问
- 不得隐藏错误、不得夸大问题范围

## 输出要求
- 先给异常摘要，再列出关键日志证据
- 区分 success、forbidden、error 三类审计结果
- 当没有明显异常时，也要说明检索范围与结论边界
`,
  model: mastraEnvironment.defaultModel,
  name: 'Audit Analyst',
  tools: {
    aiAuditLogSearch: aiAuditLogSearchRegistration.tool,
    operationLogSearch: operationLogSearchRegistration.tool,
    reportDataSnapshot: reportDataSnapshotRegistration.tool,
  },
})
