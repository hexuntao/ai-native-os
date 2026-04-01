import type { ToolAction, ToolExecutionContext } from '@mastra/core/tools'

import { mastraTools as registeredMastraTools } from './tools'

/**
 * Mastra 注册表。
 *
 * 职责边界：
 * - 统一汇总当前可用的 Agent、Tool、Workflow
 * - 不在这里做权限判断；权限必须下沉到 middleware 和 Tool/Workflow 执行层
 * - 不在这里直接写审计；审计责任由可执行单元自身承担
 *
 * 当前状态：
 * - Tool 已启用并受 RBAC + audit 约束
 * - Agent 与 Workflow 仍待后续 Phase 3 任务注册
 */
export const mastraAgents = {}

export const mastraTools = registeredMastraTools as Record<
  string,
  ToolAction<
    unknown,
    unknown,
    unknown,
    unknown,
    ToolExecutionContext<unknown, unknown, unknown>,
    string,
    unknown
  >
>

export const mastraWorkflows = {}
