import type { ToolAction, ToolExecutionContext } from '@mastra/core/tools'

import { mastraAgentRegistry } from './agents'
import { mastraTools as registeredMastraTools } from './tools'
import { mastraWorkflows as registeredMastraWorkflows } from './workflows'

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
 * - 首批只读 Agent 已注册
 * - 首个只读报表 Workflow 已注册，供 Trigger.dev 编排调用
 */
export const mastraAgents = mastraAgentRegistry

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

export const mastraWorkflows = registeredMastraWorkflows
