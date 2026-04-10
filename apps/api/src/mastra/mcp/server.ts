import { type AppAbility, aiRuntimeCapabilitySchema } from '@ai-native-os/shared'
import type { RequestContext } from '@mastra/core/request-context'
import type { ToolExecutionContext } from '@mastra/core/tools'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { Context } from 'hono'
import { z } from 'zod'

import { getMastraRuntimeSummary } from '@/mastra'
import { adminCopilot } from '@/mastra/agents'
import { getEnabledCopilotAgentIds, getEnabledMcpWrapperToolIds } from '@/mastra/discovery'
import { createMastraRequestContextFromAppContext } from '@/mastra/request-context'
import { getMastraToolCatalog, userDirectoryRegistration } from '@/mastra/tools'
import {
  reportScheduleWorkflowInputSchema,
  reportScheduleWorkflowOutputSchema,
  runReportScheduleWorkflow,
} from '@/mastra/workflows/report-schedule'
import type { ApiEnv } from '@/middleware/auth'
import { type AppContext, createAppContext } from '@/orpc/context'

export const mastraMcpEndpointPath = '/mastra/mcp'

const runtimeSummaryResourceUri = 'resource://ai-native-os/runtime-summary'
const enabledToolCatalogResourceUri = 'resource://ai-native-os/enabled-tool-catalog'

const askAdminCopilotInputSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
})

const askAdminCopilotOutputSchema = z.object({
  agentId: z.literal('admin-copilot'),
  answer: z.string(),
  runId: z.string().nullable(),
})

const mcpRuntimeSummarySchema = z.object({
  ai: aiRuntimeCapabilitySchema,
  directToolIds: z.array(z.string()),
  enabledAgentIds: z.array(z.string()),
  endpoint: z.string(),
  promptNames: z.array(z.string()),
  degradedAgentIds: z.array(z.string()),
  registeredAgentIds: z.array(z.string()),
  registeredWorkflowIds: z.array(z.string()),
  resourceUris: z.array(z.string()),
  transport: z.literal('streamable-http'),
  wrapperToolIds: z.object({
    agent: z.array(z.string()),
    direct: z.array(z.string()),
    workflow: z.array(z.string()),
  }),
})

type McpRuntimeSummary = z.infer<typeof mcpRuntimeSummarySchema>

function toUntypedRequestContext(
  requestContext: ReturnType<typeof createMastraRequestContextFromAppContext>,
): RequestContext<unknown> {
  return requestContext as unknown as RequestContext<unknown>
}

function toToolExecutionContext(
  requestContext: ReturnType<typeof createMastraRequestContextFromAppContext>,
): ToolExecutionContext<unknown, unknown, unknown> {
  return {
    requestContext: toUntypedRequestContext(requestContext),
  }
}

function serializeJsonContent(payload: unknown): { type: 'text'; text: string }[] {
  return [
    {
      text: JSON.stringify(payload, null, 2),
      type: 'text',
    },
  ]
}

/**
 * 构建当前登录主体视角下的 MCP 运行时摘要。
 *
 * 这里显式按主体能力过滤 wrapper 清单，避免 summary 继续把“已注册”误报成“当前可执行”。
 */
function getMcpRuntimeSummary(appContext: AppContext): McpRuntimeSummary {
  const runtimeSummary = getMastraRuntimeSummary()
  const enabledAgentIds = getEnabledCopilotAgentIds(appContext.ability, runtimeSummary.ai)
  const wrapperToolIds = getEnabledMcpWrapperToolIds(appContext.ability, runtimeSummary.ai)

  return mcpRuntimeSummarySchema.parse({
    ai: runtimeSummary.ai,
    directToolIds: [...wrapperToolIds.direct],
    enabledAgentIds,
    endpoint: mastraMcpEndpointPath,
    degradedAgentIds: runtimeSummary.degradedAgentIds,
    promptNames: ['system-report'],
    registeredAgentIds: runtimeSummary.registeredAgentIds,
    registeredWorkflowIds: runtimeSummary.registeredWorkflowIds,
    resourceUris: [enabledToolCatalogResourceUri, runtimeSummaryResourceUri],
    transport: 'streamable-http',
    wrapperToolIds,
  })
}

function getEnabledToolCatalogResource(
  ability: AppAbility,
): ReturnType<typeof getMastraToolCatalog> {
  return getMastraToolCatalog(ability).filter((tool) => tool.enabled)
}

/**
 * 创建当前请求专属的 MCP server。
 *
 * 架构说明：
 * - 文档基线使用 `@mastra/mcp`，但当前仓库尚未安装该包
 * - 这里采用 `@modelcontextprotocol/sdk` 做兼容实现，保持真实 MCP 协议与 Hono 集成，而不是伪造 JSON 发现端点
 * - 权限与审计继续复用既有 Agent / Workflow / Tool 运行链路，不在 MCP 层另造一套安全逻辑
 */
export function createAiNativeOsMcpServer(appContext: AppContext): McpServer {
  const requestContext = createMastraRequestContextFromAppContext(appContext)
  const runtimeSummary = getMcpRuntimeSummary(appContext)
  const enabledToolCatalog = getEnabledToolCatalogResource(appContext.ability)
  const enabledWrapperToolIds = runtimeSummary.wrapperToolIds
  const server = new McpServer({
    name: 'ai-native-os',
    version: '0.1.0',
  })

  if (enabledWrapperToolIds.agent.includes('ask_admin_copilot')) {
    server.registerTool(
      'ask_admin_copilot',
      {
        annotations: {
          openWorldHint: false,
          readOnlyHint: true,
        },
        description:
          'Ask the read-only Admin Copilot agent through the authenticated Mastra runtime.',
        inputSchema: askAdminCopilotInputSchema,
        outputSchema: askAdminCopilotOutputSchema,
        title: 'Ask Admin Copilot',
      },
      async ({ message }) => {
        const result = await adminCopilot.generate(message, {
          requestContext,
        })
        const output = askAdminCopilotOutputSchema.parse({
          agentId: 'admin-copilot',
          answer: result.text,
          runId: result.runId ?? null,
        })

        return {
          content: serializeJsonContent(output),
          structuredContent: output,
        }
      },
    )
  }

  if (enabledWrapperToolIds.workflow.includes('run_report_schedule')) {
    server.registerTool(
      'run_report_schedule',
      {
        annotations: {
          openWorldHint: false,
          readOnlyHint: true,
        },
        description:
          'Execute the audited read-only report schedule workflow with the current authenticated principal.',
        inputSchema: reportScheduleWorkflowInputSchema,
        outputSchema: reportScheduleWorkflowOutputSchema,
        title: 'Run Report Schedule Workflow',
      },
      async (input) => {
        const output = await runReportScheduleWorkflow({
          input: reportScheduleWorkflowInputSchema.parse(input),
          requestContext,
        })

        return {
          content: serializeJsonContent(output),
          structuredContent: output,
        }
      },
    )
  }

  if (enabledWrapperToolIds.direct.includes('tool_user_directory')) {
    server.registerTool(
      'tool_user_directory',
      {
        annotations: {
          openWorldHint: false,
          readOnlyHint: true,
        },
        description:
          'Query the authenticated user directory tool with the current RBAC rules and AI audit protections.',
        inputSchema: userDirectoryRegistration.inputSchema,
        outputSchema: userDirectoryRegistration.outputSchema,
        title: 'User Directory Tool',
      },
      async (input) => {
        const execute = userDirectoryRegistration.tool.execute

        if (!execute) {
          throw new Error('user-directory tool execute handler is not available')
        }

        const output = userDirectoryRegistration.outputSchema.parse(
          await execute(input, toToolExecutionContext(requestContext)),
        ) as Record<string, unknown>

        return {
          content: serializeJsonContent(output),
          structuredContent: output,
        }
      },
    )
  }

  server.registerResource(
    'runtime-summary',
    runtimeSummaryResourceUri,
    {
      description: 'Current Mastra runtime and MCP wrapper summary for AI Native OS.',
      mimeType: 'application/json',
      title: 'Runtime Summary',
    },
    async (uri) => ({
      contents: [
        {
          mimeType: 'application/json',
          text: JSON.stringify(runtimeSummary, null, 2),
          uri: uri.toString(),
        },
      ],
    }),
  )

  server.registerResource(
    'enabled-tool-catalog',
    enabledToolCatalogResourceUri,
    {
      description: 'Tool catalog filtered by the current authenticated principal permissions.',
      mimeType: 'application/json',
      title: 'Enabled Tool Catalog',
    },
    async (uri) => ({
      contents: [
        {
          mimeType: 'application/json',
          text: JSON.stringify({ tools: enabledToolCatalog }, null, 2),
          uri: uri.toString(),
        },
      ],
    }),
  )

  server.registerPrompt(
    'system-report',
    {
      argsSchema: {
        focus: z.string().trim().min(1).max(120).optional(),
      },
      description:
        'Generate a structured system report prompt seeded with the current runtime summary and enabled tools.',
      title: 'System Report Prompt',
    },
    async ({ focus }) => ({
      description: 'Prompt for generating a concise AI Native OS system report.',
      messages: [
        {
          content: {
            text: [
              '请基于以下 AI Native OS 运行态数据生成系统报告。',
              focus ? `重点关注：${focus}` : '重点关注：整体系统运行态、权限面与 AI 能力可用性。',
              `运行时摘要：${JSON.stringify(runtimeSummary)}`,
              `当前主体可用工具：${JSON.stringify({ tools: enabledToolCatalog })}`,
            ].join('\n'),
            type: 'text',
          },
          role: 'user',
        },
      ],
    }),
  )

  return server
}

async function requireAuthenticatedMcpAppContext<TEnv extends ApiEnv>(
  c: Context<TEnv>,
): Promise<AppContext | Response> {
  const appContext = await createAppContext(c)

  if (!appContext.session || !appContext.userId) {
    return c.json(
      {
        code: 'UNAUTHORIZED',
        message: 'Authentication required for MCP routes',
      },
      401,
    )
  }

  return appContext
}

/**
 * 处理 `/mastra/mcp` 请求。
 *
 * 安全边界：
 * - 必须先经过 Better Auth 会话解析
 * - 再把当前主体的 RBAC 画像绑定到 MCP server 生命周期
 * - 每个请求创建独立 server/transport，避免跨用户共享会话状态
 */
export async function handleMastraMcpRequest<TEnv extends ApiEnv>(
  c: Context<TEnv>,
): Promise<Response> {
  const appContextOrResponse = await requireAuthenticatedMcpAppContext(c)

  if (appContextOrResponse instanceof Response) {
    return appContextOrResponse
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  })
  const server = createAiNativeOsMcpServer(appContextOrResponse)

  await server.connect(transport)

  return transport.handleRequest(c.req.raw)
}
