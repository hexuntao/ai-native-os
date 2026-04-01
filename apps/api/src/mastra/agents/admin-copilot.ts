import { Agent } from '@mastra/core/agent'

import { resolveMastraEnvironment } from '@/mastra/env'
import {
  knowledgeSemanticSearchRegistration,
  permissionProfileRegistration,
  reportDataSnapshotRegistration,
  runtimeConfigRegistration,
  userDirectoryRegistration,
} from '@/mastra/tools'

const mastraEnvironment = resolveMastraEnvironment()

/**
 * 全局管理 Copilot。
 *
 * 职责边界：
 * - 面向后台管理员提供只读查询、权限画像与系统概览能力
 * - 仅组合已经具备 RBAC 与 AI 审计约束的 Tool，不直接绕过权限体系
 * - 当前阶段禁止写操作、删除操作、审批动作与任何需要人工确认的变更
 *
 * 权限与审计：
 * - Agent 自身不放宽权限，实际数据访问以 Tool 级 CASL 校验为准
 * - 所有 Tool 调用继续落入既有 AI audit log
 */
export const adminCopilot = new Agent({
  description:
    'Read-only administration copilot for user lookup, permission introspection, runtime config inspection, and operational snapshots.',
  id: 'admin-copilot',
  instructions: `
你是 AI Native OS 的全局管理助手。

## 职责
- 帮助管理员理解系统当前状态、权限配置与用户分布
- 优先使用结构化 Tool 查询事实，不凭空编造系统数据
- 输出简洁、可执行的结论与下一步建议

## 能力范围
- 用户目录查询
- 权限画像查询
- 运行时安全配置读取
- 报表快照汇总
- 知识库语义检索

## 严格约束
- 当前阶段只允许只读分析，不执行任何写操作
- 不得绕过 Tool 的 RBAC 校验
- 当 Tool 返回权限不足时，必须明确说明无法访问的原因
- 不得捏造不存在的数据、角色、配置或统计结果

## 输出要求
- 先给结论，再给关键证据
- 引用 Tool 返回的结构化数据进行说明
- 当信息不足时，明确指出缺失项
`,
  model: mastraEnvironment.defaultModel,
  name: 'Admin Copilot',
  tools: {
    permissionProfile: permissionProfileRegistration.tool,
    knowledgeSemanticSearch: knowledgeSemanticSearchRegistration.tool,
    reportDataSnapshot: reportDataSnapshotRegistration.tool,
    runtimeConfig: runtimeConfigRegistration.tool,
    userDirectory: userDirectoryRegistration.tool,
  },
})
