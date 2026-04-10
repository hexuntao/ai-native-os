import { MastraAgent } from '@ag-ui/mastra'
import {
  type CopilotBridgeSummary,
  copilotBridgeSummarySchema,
  copilotSessionContextEventSchema,
} from '@ai-native-os/shared'
import {
  CopilotRuntime,
  copilotRuntimeNodeHttpEndpoint,
  ExperimentalEmptyAdapter,
} from '@copilotkit/runtime'
import type { RequestContext } from '@mastra/core/request-context'
import type { Context } from 'hono'

import { mastra } from '@/mastra'
import { resolveAiRuntimeCapability } from '@/mastra/capabilities'
import { getEnabledCopilotAgentIds } from '@/mastra/discovery'
import { createMastraRequestContextFromAppContext } from '@/mastra/request-context'
import type { ApiEnv } from '@/middleware/auth'
import { type AppContext, createAppContext } from '@/orpc/context'

export const copilotKitEndpointPath = '/api/copilotkit'
export const agUiRuntimePath = '/api/ag-ui/runtime'
export const agUiRuntimeEventsPath = '/api/ag-ui/runtime/events'
export const defaultCopilotAgentId = 'admin-copilot'

type CopilotRuntimeAgents = NonNullable<
  NonNullable<ConstructorParameters<typeof CopilotRuntime>[0]>['agents']
>
type CopilotRuntimeAgentMap = Awaited<CopilotRuntimeAgents>

function resolveCopilotResourceId(context: AppContext): string {
  return context.rbacUserId ?? context.userId ?? 'anonymous'
}

/**
 * 为 Copilot 不可用场景生成稳定的错误响应。
 */
function createCopilotUnavailableResponse(summary: CopilotBridgeSummary): Response {
  if (summary.capability.status === 'degraded') {
    return Response.json(
      {
        code: 'AI_DEGRADED',
        message: summary.capability.reason,
      },
      {
        status: 503,
      },
    )
  }

  return Response.json(
    {
      code: 'FORBIDDEN',
      message: 'The current principal does not have permission to use any Copilot agents.',
    },
    {
      status: 403,
    },
  )
}

/**
 * 生成当前登录主体的 Copilot/AG-UI 桥接摘要。
 *
 * 职责边界：
 * - 只暴露后端桥接所需的发现信息，不承载实际聊天内容
 * - `resourceId` 明确绑定到当前主体，避免跨用户共享 Agent memory 语义
 */
export function getCopilotBridgeSummary(context: AppContext): CopilotBridgeSummary {
  const capability = resolveAiRuntimeCapability()
  const agentIds = getEnabledCopilotAgentIds(context.ability, capability)

  return copilotBridgeSummarySchema.parse({
    agentIds,
    authRequired: true,
    capability,
    defaultAgentId: agentIds.includes(defaultCopilotAgentId) ? defaultCopilotAgentId : null,
    endpoint: copilotKitEndpointPath,
    protocol: 'ag-ui',
    resourceId: resolveCopilotResourceId(context),
    runtimePath: agUiRuntimePath,
    transport: 'streaming-http',
  })
}

/**
 * 要求 Copilot bridge 请求已经具备认证上下文。
 *
 * 这里显式复用应用级 AppContext，保证 Copilot 通道不会绕过 Better Auth 与 RBAC 装配逻辑。
 */
export async function requireAuthenticatedAppContext<TEnv extends ApiEnv>(
  c: Context<TEnv>,
): Promise<AppContext | Response> {
  const appContext = await createAppContext(c)

  if (!appContext.session || !appContext.userId) {
    return c.json(
      {
        code: 'UNAUTHORIZED',
        message: 'Authentication required for Copilot bridge routes',
      },
      401,
    )
  }

  return appContext
}

/**
 * 按当前登录主体动态创建 Copilot runtime。
 *
 * 关键约束：
 * - 运行时必须按请求动态构建，不能使用固定 `resourceId`
 * - 仅暴露当前已注册的只读 Agent，避免在桥接层提前扩大写风险
 */
export function createCopilotRuntimeForAppContext(context: AppContext): CopilotRuntime {
  const requestContext = createMastraRequestContextFromAppContext(context) as RequestContext
  const resourceId = resolveCopilotResourceId(context)
  const enabledAgentIds = getEnabledCopilotAgentIds(context.ability)
  const localAgents = MastraAgent.getLocalAgents({
    mastra,
    requestContext,
    resourceId,
  }) as unknown as CopilotRuntimeAgentMap
  const agents = Object.fromEntries(
    enabledAgentIds.flatMap((agentId) => {
      const agent = localAgents[agentId]

      return agent ? [[agentId, agent]] : []
    }),
  ) as CopilotRuntimeAgentMap

  return new CopilotRuntime({
    agents,
  })
}

/**
 * 处理 CopilotKit 兼容的后端桥接请求。
 *
 * 当前阶段只落后端入口，不在这里耦合任何前端 UI 组件。
 */
export async function handleCopilotKitRequest<TEnv extends ApiEnv>(
  c: Context<TEnv>,
): Promise<Response> {
  const appContextOrResponse = await requireAuthenticatedAppContext(c)

  if (appContextOrResponse instanceof Response) {
    return appContextOrResponse
  }

  const summary = getCopilotBridgeSummary(appContextOrResponse)

  if (summary.capability.status === 'degraded' || !summary.defaultAgentId) {
    return createCopilotUnavailableResponse(summary)
  }

  const runtime = createCopilotRuntimeForAppContext(appContextOrResponse)
  const endpoint = copilotRuntimeNodeHttpEndpoint({
    endpoint: copilotKitEndpointPath,
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
  })

  return endpoint(c.req.raw) as Promise<Response>
}

/**
 * 暴露 AG-UI bridge 发现信息，供后续前端集成与 smoke test 使用。
 */
export async function handleAgUiRuntimeSummaryRequest<TEnv extends ApiEnv>(
  c: Context<TEnv>,
): Promise<Response> {
  const appContextOrResponse = await requireAuthenticatedAppContext(c)

  if (appContextOrResponse instanceof Response) {
    return appContextOrResponse
  }

  return c.json(getCopilotBridgeSummary(appContextOrResponse))
}

function encodeSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/**
 * 暴露最小 SSE 事件流，验证 AG-UI 桥接路径的流式能力与认证上下文注入。
 *
 * 说明：
 * - 这是桥接诊断流，不替代 CopilotKit 的完整对话协议
 * - 主要用于后端 smoke test 和前端运行时发现
 */
export async function handleAgUiRuntimeEventsRequest<TEnv extends ApiEnv>(
  c: Context<TEnv>,
): Promise<Response> {
  const appContextOrResponse = await requireAuthenticatedAppContext(c)

  if (appContextOrResponse instanceof Response) {
    return appContextOrResponse
  }

  const summary = getCopilotBridgeSummary(appContextOrResponse)

  if (summary.capability.status === 'degraded' || summary.agentIds.length === 0) {
    return createCopilotUnavailableResponse(summary)
  }

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      const chunks = [
        encodeSseEvent('runtime.ready', summary),
        encodeSseEvent(
          'session.context',
          copilotSessionContextEventSchema.parse({
            requestId: appContextOrResponse.requestId,
            roleCodes: appContextOrResponse.roleCodes,
            userId: appContextOrResponse.userId,
          }),
        ),
      ]

      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }

      controller.close()
    },
  })

  return new Response(body, {
    headers: {
      'cache-control': 'no-cache',
      'content-type': 'text/event-stream; charset=utf-8',
      connection: 'keep-alive',
    },
    status: 200,
  })
}
