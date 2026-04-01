import { experimental_createMCPClient, type experimental_MCPClient } from '@ai-sdk/mcp'

/**
 * 外部 MCP Client 配置。
 *
 * 设计约束：
 * - 当前仅支持远程 HTTP MCP server，避免在 Phase 3 额外引入本地命令执行面
 * - 不在这里偷偷附带默认公网地址，必须显式传入或由环境变量提供
 */
export interface ExternalMcpClientOptions {
  env?: NodeJS.ProcessEnv
  headers?: Record<string, string>
  name?: string
  url?: string
}

export interface ExternalMcpResolvedConfig {
  headers: Record<string, string>
  name: string
  url: string
}

export interface McpDiscoverySnapshot {
  promptNames: string[]
  resourceTemplateNames: string[]
  resourceUris: string[]
  toolNames: string[]
}

const defaultExternalMcpClientName = 'ai-native-os-external-mcp-client'

/**
 * 解析外部 MCP 连接配置。
 *
 * 环境变量约定：
 * - `EXTERNAL_MCP_SERVER_URL`
 * - `EXTERNAL_MCP_AUTH_HEADER_NAME`
 * - `EXTERNAL_MCP_AUTH_HEADER_VALUE`
 */
export function resolveExternalMcpClientConfig(
  options: ExternalMcpClientOptions = {},
): ExternalMcpResolvedConfig {
  const env = options.env ?? process.env
  const url = options.url ?? env.EXTERNAL_MCP_SERVER_URL

  if (!url) {
    throw new Error(
      'External MCP server URL is required. Pass `url` explicitly or set EXTERNAL_MCP_SERVER_URL.',
    )
  }

  const authHeaderName = env.EXTERNAL_MCP_AUTH_HEADER_NAME
  const authHeaderValue = env.EXTERNAL_MCP_AUTH_HEADER_VALUE
  const inheritedHeaders =
    authHeaderName && authHeaderValue ? { [authHeaderName]: authHeaderValue } : {}

  return {
    headers: {
      ...inheritedHeaders,
      ...(options.headers ?? {}),
    },
    name: options.name ?? defaultExternalMcpClientName,
    url,
  }
}

/**
 * 创建外部 MCP client。
 *
 * 当前实现使用 `@ai-sdk/mcp` 作为兼容客户端层，满足 Phase 3 对外部 MCP 集成与发现能力的要求。
 */
export async function createExternalMcpClient(
  options: ExternalMcpClientOptions = {},
): Promise<experimental_MCPClient> {
  const resolvedConfig = resolveExternalMcpClientConfig(options)

  return experimental_createMCPClient({
    name: resolvedConfig.name,
    transport: {
      headers: resolvedConfig.headers,
      type: 'http',
      url: resolvedConfig.url,
    },
  })
}

/**
 * 发现远程 MCP server 暴露的 tool / resource / prompt 清单。
 *
 * 该函数用于 Phase 3 的集成验证，也为后续接入第三方 MCP server 保留统一发现入口。
 */
export async function discoverExternalMcpSnapshot(
  options: ExternalMcpClientOptions = {},
): Promise<McpDiscoverySnapshot> {
  const client = await createExternalMcpClient(options)

  try {
    const [tools, resources, resourceTemplates, prompts] = await Promise.all([
      client.tools(),
      client.listResources(),
      client.listResourceTemplates(),
      client.listPrompts(),
    ])

    return {
      promptNames: prompts.prompts.map((prompt) => prompt.name).sort(),
      resourceTemplateNames: resourceTemplates.resourceTemplates
        .map((resourceTemplate) => resourceTemplate.name)
        .sort(),
      resourceUris: resources.resources.map((resource) => resource.uri).sort(),
      toolNames: Object.keys(tools).sort(),
    }
  } finally {
    await client.close()
  }
}
