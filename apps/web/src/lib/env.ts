export interface WebEnvironment {
  apiUrl: string
  appUrl: string
}

type EnvironmentVariables = Readonly<Record<string, string | undefined>>

const defaultLocalAppUrl = 'http://localhost:3000'
const defaultLocalApiUrl = 'http://localhost:3001'

/**
 * 把 Vercel 提供的无协议域名标准化为可直接请求的 HTTPS URL。
 */
function normalizeDeploymentUrl(urlOrDomain: string): string {
  return urlOrDomain.startsWith('http://') || urlOrDomain.startsWith('https://')
    ? urlOrDomain
    : `https://${urlOrDomain}`
}

/**
 * 在 Vercel 运行时解析当前部署 URL，避免 preview 环境错误回退到 localhost。
 */
function resolveVercelDeploymentUrl(
  environment: EnvironmentVariables = process.env,
): string | undefined {
  if (environment.VERCEL !== '1') {
    return undefined
  }

  const deploymentDomain = environment.VERCEL_URL?.trim()

  return deploymentDomain ? normalizeDeploymentUrl(deploymentDomain) : undefined
}

/**
 * 解析 web 运行时依赖的 app/api 地址。
 *
 * 部署约束：
 * - 本地开发继续保持 `localhost` 默认值
 * - Vercel preview 在未显式提供 URL 时优先回退到当前部署域名，避免把请求发往本机
 * - 要获得完整后端能力，仍然应显式配置 `API_URL`
 */
export function resolveWebEnvironment(
  environment: EnvironmentVariables = process.env,
): WebEnvironment {
  const deploymentUrl = resolveVercelDeploymentUrl(environment)

  return {
    apiUrl: environment.API_URL?.trim() || deploymentUrl || defaultLocalApiUrl,
    appUrl: environment.APP_URL?.trim() || deploymentUrl || defaultLocalAppUrl,
  }
}
