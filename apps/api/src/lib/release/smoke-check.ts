import { healthResponseSchema } from '@ai-native-os/shared'
import { z } from 'zod'

const apiPingEnvelopeSchema = z.object({
  json: z.object({
    ok: z.literal(true),
    service: z.literal('api'),
    timestamp: z.string().min(1),
  }),
})

const webHealthPayloadSchema = z.object({
  service: z.literal('@ai-native-os/web'),
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
})

const jobsHealthPayloadSchema = z.object({
  runtime: z.object({
    name: z.literal('@ai-native-os/jobs'),
    scheduledTaskIds: z.array(z.string()),
    status: z.string().min(1),
    taskIds: z.array(z.string()),
    triggerConfigPath: z.string().min(1),
  }),
  service: z.literal('@ai-native-os/jobs'),
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
})

export interface ReleaseSmokeEnvironment {
  apiBaseUrl: string
  appBaseUrl: string
  includeJobs: boolean
  jobsHealthUrl: string | null
  timeoutMs: number
}

export interface ReleaseSmokeResult {
  detail: string
  durationMs: number
  name: string
  statusCode: number
  url: string
}

export interface ReleaseSmokeSummary {
  checkedAt: string
  results: ReleaseSmokeResult[]
  status: 'ok'
  warnings: string[]
}

export interface ReleaseSmokeDependencies {
  fetcher: typeof fetch
  now: () => Date
}

interface ProbeValidationResult {
  detail: string
  warnings: string[]
}

interface ProbeExecutionResult {
  result: ReleaseSmokeResult
  warnings: string[]
}

const defaultReleaseSmokeDependencies: ReleaseSmokeDependencies = {
  fetcher: globalThis.fetch,
  now: () => new Date(),
}

/**
 * 将布尔风格环境变量解析为稳定布尔值。
 */
function parseBooleanFlag(rawValue: string | undefined): boolean {
  if (!rawValue) {
    return false
  }

  return ['1', 'true', 'yes', 'on'].includes(rawValue.trim().toLowerCase())
}

/**
 * 解析正整数环境变量，避免超时或端口类配置接受非法值。
 */
function parsePositiveInteger(
  rawValue: string | undefined,
  fallbackValue: number,
  label: string,
): number {
  if (!rawValue?.trim()) {
    return fallbackValue
  }

  const parsedValue = Number.parseInt(rawValue, 10)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }

  return parsedValue
}

/**
 * 规范化基础 URL，确保后续路径拼接不会受尾部斜杠影响。
 */
function normalizeBaseUrl(rawUrl: string, label: string): string {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error(`${label} must be a valid absolute URL`)
  }

  parsedUrl.hash = ''
  parsedUrl.search = ''
  parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '')

  return parsedUrl.toString().replace(/\/$/, '')
}

/**
 * 解析 jobs 健康检查地址。
 *
 * 允许直接给完整 `/health` 地址，也允许只给基础域名后续自动补路径。
 */
function normalizeJobsHealthUrl(rawUrl: string): string {
  const normalizedBaseUrl = normalizeBaseUrl(rawUrl, 'JOBS_HEALTH_URL')

  if (normalizedBaseUrl.endsWith('/health')) {
    return normalizedBaseUrl
  }

  return new URL('/health', `${normalizedBaseUrl}/`).toString()
}

/**
 * 拼接发布 smoke 需要访问的完整 URL。
 */
function buildEndpointUrl(baseUrl: string, pathname: string): string {
  return new URL(pathname, `${baseUrl}/`).toString()
}

/**
 * 提取底层异常信息，避免网络类错误只剩下模糊的 `fetch failed` 文本。
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.cause instanceof Error && error.cause.message.trim()) {
      return `${error.message}: ${error.cause.message}`
    }

    return error.message
  }

  return String(error)
}

/**
 * 为 smoke 探针失败补齐端点上下文，便于快速定位发布阻塞点。
 */
function createProbeExecutionError(name: string, url: string, error: unknown): Error {
  return new Error(`Smoke probe "${name}" failed for ${url}: ${extractErrorMessage(error)}`)
}

/**
 * 解析发布 smoke 脚本运行环境。
 */
export function resolveReleaseSmokeEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ReleaseSmokeEnvironment {
  const appBaseUrl = normalizeBaseUrl(
    environment.RELEASE_APP_URL?.trim() || environment.APP_URL?.trim() || 'http://localhost:3000',
    'APP_URL',
  )
  const apiBaseUrl = normalizeBaseUrl(
    environment.RELEASE_API_URL?.trim() ||
      environment.API_URL?.trim() ||
      environment.RELEASE_APP_URL?.trim() ||
      environment.APP_URL?.trim() ||
      'http://localhost:3001',
    'API_URL',
  )
  const includeJobs =
    parseBooleanFlag(environment.RELEASE_INCLUDE_JOBS) ||
    Boolean(environment.JOBS_HEALTH_URL?.trim())

  return {
    apiBaseUrl,
    appBaseUrl,
    includeJobs,
    jobsHealthUrl: includeJobs
      ? normalizeJobsHealthUrl(
          environment.JOBS_HEALTH_URL?.trim() || 'http://localhost:3040/health',
        )
      : null,
    timeoutMs: parsePositiveInteger(environment.RELEASE_TIMEOUT_MS, 15000, 'RELEASE_TIMEOUT_MS'),
  }
}

/**
 * 带超时执行 HTTP 请求，避免发布 smoke 在单个端点上无限等待。
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  fetcher: typeof fetch,
): Promise<Response> {
  return fetcher(url, {
    headers: {
      accept: 'application/json, text/html;q=0.9,*/*;q=0.8',
    },
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/**
 * 读取 JSON 响应体，并在状态码不符合预期时抛出包含正文的错误。
 */
async function readJsonResponseOrThrow(response: Response): Promise<unknown> {
  const payloadText = await response.text()

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${payloadText}`)
  }

  if (!payloadText.trim()) {
    throw new Error(
      `Expected JSON payload but received an empty response with status ${response.status}`,
    )
  }

  return JSON.parse(payloadText) as unknown
}

/**
 * 读取文本响应体，并在状态码不符合预期时抛出包含正文的错误。
 */
async function readTextResponseOrThrow(response: Response): Promise<string> {
  const payloadText = await response.text()

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${payloadText}`)
  }

  return payloadText
}

/**
 * 校验 API 健康响应，并把允许降级但需要关注的项转成 warning。
 */
function validateApiHealthPayload(payload: unknown): ProbeValidationResult {
  const healthPayload = healthResponseSchema.parse(payload)
  const warnings: string[] = []

  if (healthPayload.checks.database !== 'ok') {
    throw new Error(`API database health must be ok, received ${healthPayload.checks.database}`)
  }

  if (healthPayload.checks.redis === 'error') {
    throw new Error('API redis health is error')
  }

  if (healthPayload.checks.telemetry.openTelemetry === 'error') {
    throw new Error('API OpenTelemetry health is error')
  }

  if (healthPayload.checks.telemetry.sentry === 'error') {
    throw new Error('API Sentry health is error')
  }

  if (healthPayload.checks.redis === 'unknown') {
    warnings.push('API redis health is unknown')
  }

  if (healthPayload.checks.telemetry.openTelemetry === 'unknown') {
    warnings.push('API OpenTelemetry health is unknown')
  }

  if (healthPayload.checks.telemetry.sentry === 'unknown') {
    warnings.push('API Sentry health is unknown')
  }

  return {
    detail: `api=${healthPayload.checks.api}, database=${healthPayload.checks.database}, redis=${healthPayload.checks.redis}, telemetry=${healthPayload.checks.telemetry.openTelemetry}/${healthPayload.checks.telemetry.sentry}`,
    warnings,
  }
}

/**
 * 校验 API ping 响应，确保 contract-first 主链路可访问。
 */
function validateApiPingPayload(payload: unknown): ProbeValidationResult {
  const pingPayload = apiPingEnvelopeSchema.parse(payload)

  return {
    detail: `service=${pingPayload.json.service}`,
    warnings: [],
  }
}

/**
 * 校验 web 健康响应。
 */
function validateWebHealthPayload(payload: unknown): ProbeValidationResult {
  const webHealthPayload = webHealthPayloadSchema.parse(payload)

  return {
    detail: `service=${webHealthPayload.service}, status=${webHealthPayload.status}`,
    warnings: [],
  }
}

/**
 * 校验 jobs 健康响应。
 */
function validateJobsHealthPayload(payload: unknown): ProbeValidationResult {
  const jobsHealthPayload = jobsHealthPayloadSchema.parse(payload)

  return {
    detail: `service=${jobsHealthPayload.service}, tasks=${jobsHealthPayload.runtime.taskIds.length}`,
    warnings: [],
  }
}

/**
 * 校验首页返回的是可访问页面，而不是空响应或错误载荷。
 */
function validateHtmlPayload(payload: string): ProbeValidationResult {
  const normalizedPayload = payload.toLowerCase()

  if (!normalizedPayload.includes('<html') && !normalizedPayload.includes('<!doctype html')) {
    throw new Error('Expected an HTML document from the application root')
  }

  return {
    detail: 'HTML document reachable',
    warnings: [],
  }
}

/**
 * 执行 JSON 类型的 smoke 探针。
 */
async function runJsonProbe(
  name: string,
  url: string,
  timeoutMs: number,
  fetcher: typeof fetch,
  validator: (payload: unknown) => ProbeValidationResult,
): Promise<ProbeExecutionResult> {
  const startedAt = Date.now()

  try {
    const response = await fetchWithTimeout(url, timeoutMs, fetcher)
    const payload = await readJsonResponseOrThrow(response)
    const validationResult = validator(payload)

    return {
      result: {
        detail: validationResult.detail,
        durationMs: Date.now() - startedAt,
        name,
        statusCode: response.status,
        url,
      },
      warnings: validationResult.warnings,
    }
  } catch (error: unknown) {
    throw createProbeExecutionError(name, url, error)
  }
}

/**
 * 执行 HTML 页面可访问性探针。
 */
async function runTextProbe(
  name: string,
  url: string,
  timeoutMs: number,
  fetcher: typeof fetch,
  validator: (payload: string) => ProbeValidationResult,
): Promise<ProbeExecutionResult> {
  const startedAt = Date.now()

  try {
    const response = await fetchWithTimeout(url, timeoutMs, fetcher)
    const payload = await readTextResponseOrThrow(response)
    const validationResult = validator(payload)

    return {
      result: {
        detail: validationResult.detail,
        durationMs: Date.now() - startedAt,
        name,
        statusCode: response.status,
        url,
      },
      warnings: validationResult.warnings,
    }
  } catch (error: unknown) {
    throw createProbeExecutionError(name, url, error)
  }
}

/**
 * 执行完整发布 smoke。
 */
export async function runReleaseSmokeChecks(
  environment: ReleaseSmokeEnvironment = resolveReleaseSmokeEnvironment(),
  dependencies: ReleaseSmokeDependencies = defaultReleaseSmokeDependencies,
): Promise<ReleaseSmokeSummary> {
  const probeTasks: Array<() => Promise<ProbeExecutionResult>> = [
    () =>
      runJsonProbe(
        'api-health',
        buildEndpointUrl(environment.apiBaseUrl, '/health'),
        environment.timeoutMs,
        dependencies.fetcher,
        validateApiHealthPayload,
      ),
    () =>
      runJsonProbe(
        'api-ping',
        buildEndpointUrl(environment.apiBaseUrl, '/api/v1/system/ping'),
        environment.timeoutMs,
        dependencies.fetcher,
        validateApiPingPayload,
      ),
    () =>
      runJsonProbe(
        'web-health',
        buildEndpointUrl(environment.appBaseUrl, '/healthz'),
        environment.timeoutMs,
        dependencies.fetcher,
        validateWebHealthPayload,
      ),
    () =>
      runTextProbe(
        'web-root',
        buildEndpointUrl(environment.appBaseUrl, '/'),
        environment.timeoutMs,
        dependencies.fetcher,
        validateHtmlPayload,
      ),
  ]

  if (environment.includeJobs && environment.jobsHealthUrl) {
    const jobsHealthUrl = environment.jobsHealthUrl

    probeTasks.push(() =>
      runJsonProbe(
        'jobs-health',
        jobsHealthUrl,
        environment.timeoutMs,
        dependencies.fetcher,
        validateJobsHealthPayload,
      ),
    )
  }

  const settledResults: ProbeExecutionResult[] = []

  /**
   * 依次执行探针，避免本地 `next dev` 冷启动时并发请求把健康检查误判为超时。
   */
  for (const runProbe of probeTasks) {
    settledResults.push(await runProbe())
  }

  return {
    checkedAt: dependencies.now().toISOString(),
    results: settledResults.map((entry) => entry.result),
    status: 'ok',
    warnings: settledResults.flatMap((entry) => entry.warnings),
  }
}
