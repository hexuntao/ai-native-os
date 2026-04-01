export interface MastraEnvironment {
  defaultModel: string
  openapiPath: string
  routePrefix: string
}

const defaultMastraModel = 'openai/gpt-4.1-mini'
const defaultMastraOpenApiPath = '/openapi.json'
const defaultMastraRoutePrefix = '/mastra'

function normalizePath(pathname: string): string {
  if (pathname === '/') {
    return pathname
  }

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`

  return normalizedPath.replace(/\/+$/, '')
}

export function resolveMastraEnvironment(env: NodeJS.ProcessEnv = process.env): MastraEnvironment {
  return {
    defaultModel: env.MASTRA_DEFAULT_MODEL ?? defaultMastraModel,
    openapiPath: normalizePath(env.MASTRA_OPENAPI_PATH ?? defaultMastraOpenApiPath),
    routePrefix: normalizePath(env.MASTRA_ROUTE_PREFIX ?? defaultMastraRoutePrefix),
  }
}
