import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const runtimeEnvironmentKeys = [
  'NODE_ENV',
  'APP_URL',
  'API_URL',
  'PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_HEALTH_TIMEOUT_MS',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'BETTER_AUTH_TRUSTED_ORIGINS',
  'OPENAI_API_KEY',
  'MASTRA_DEFAULT_MODEL',
  'MASTRA_OPENAPI_PATH',
  'MASTRA_ROUTE_PREFIX',
  'MASTRA_RAG_EMBEDDING_MODEL',
  'EXTERNAL_MCP_SERVER_URL',
  'EXTERNAL_MCP_AUTH_HEADER_NAME',
  'EXTERNAL_MCP_AUTH_HEADER_VALUE',
  'TRIGGER_SECRET_KEY',
  'TRIGGER_API_URL',
  'SENTRY_DSN',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_SERVICE_NAME',
  'TELEMETRY_TRACES_SAMPLE_RATE',
] as const

const deployContractKeys = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'TRIGGER_ACCESS_TOKEN',
  'VERCEL_TOKEN',
  'VERCEL_ORG_ID',
  'VERCEL_PROJECT_ID',
  'R2_BUCKET',
  'NOTIFICATION_QUEUE',
  'CACHE_INVALIDATION_QUEUE',
] as const

/**
 * 解析 `.env.example` 中实际声明的环境变量键。
 */
function parseEnvironmentKeys(source: string): Set<string> {
  const keys = source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split('=')[0]?.trim())
    .filter((key): key is string => Boolean(key))

  return new Set(keys)
}

/**
 * 读取仓库根目录下的环境合同文档。
 */
function readRepositoryContractFiles(): {
  environmentExample: string
  environmentMatrix: string
} {
  const repositoryRoot = resolve(process.cwd(), '..', '..')

  return {
    environmentExample: readFileSync(resolve(repositoryRoot, '.env.example'), 'utf8'),
    environmentMatrix: readFileSync(resolve(repositoryRoot, 'docs/environment-matrix.md'), 'utf8'),
  }
}

/**
 * 校验 `.env.example` 是否覆盖当前仓库真实读取的运行时环境变量。
 */
function verifyEnvironmentExampleCoverage(): void {
  const { environmentExample } = readRepositoryContractFiles()
  const declaredKeys = parseEnvironmentKeys(environmentExample)

  for (const requiredKey of runtimeEnvironmentKeys) {
    assert.ok(
      declaredKeys.has(requiredKey),
      `Expected .env.example to declare runtime key ${requiredKey}`,
    )
  }
}

/**
 * 校验环境矩阵文档是否声明了运行时键、部署凭据与 worker 绑定合同。
 */
function verifyEnvironmentMatrixDocumentation(): void {
  const { environmentMatrix } = readRepositoryContractFiles()

  for (const documentedKey of [...runtimeEnvironmentKeys, ...deployContractKeys]) {
    assert.match(
      environmentMatrix,
      new RegExp(`\`${documentedKey}\``),
      `Expected docs/environment-matrix.md to document ${documentedKey}`,
    )
  }

  assert.match(environmentMatrix, /P6-F1/)
  assert.match(environmentMatrix, /GET \/health/)
  assert.match(environmentMatrix, /P6-T3/)
  assert.match(environmentMatrix, /Mode A: 全 Serverless/)
  assert.match(environmentMatrix, /Mode B: 混合/)
  assert.match(environmentMatrix, /Mode C: 全自托管/)
}

test(
  '.env.example covers every runtime environment variable consumed by the repository',
  verifyEnvironmentExampleCoverage,
)

test(
  'environment matrix documents runtime keys, deploy credentials, and worker bindings',
  verifyEnvironmentMatrixDocumentation,
)
