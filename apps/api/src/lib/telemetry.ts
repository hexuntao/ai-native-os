import type { DependencyHealthStatus } from '@ai-native-os/shared'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'
import * as Sentry from '@sentry/node'

export interface ApiTelemetryConfig {
  environment: string
  otlpEndpoint: string | null
  sentryDsn: string | null
  serviceName: string
  tracesSampleRate: number
}

export interface TelemetryNodeSdkLike {
  shutdown(): Promise<void>
  start(): void
}

export type TelemetryNodeSdkConfiguration = NonNullable<ConstructorParameters<typeof NodeSDK>[0]>
export type TelemetryTraceExporter = NonNullable<TelemetryNodeSdkConfiguration['traceExporter']>

export interface TelemetryBootstrapDependencies {
  createNodeSdk: (configuration: TelemetryNodeSdkConfiguration) => TelemetryNodeSdkLike
  createTraceExporter: (
    configuration: ConstructorParameters<typeof OTLPTraceExporter>[0],
  ) => TelemetryTraceExporter
  getAutoInstrumentations: typeof getNodeAutoInstrumentations
  initSentry: typeof Sentry.init
}

export interface ApiTelemetryRuntimeState {
  issues: string[]
  openTelemetry: DependencyHealthStatus
  sentry: DependencyHealthStatus
  serviceName: string
}

const defaultServiceName = 'ai-native-os-api'

let cachedTelemetryState: ApiTelemetryRuntimeState | null = null

function parseSampleRate(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback
  }

  const parsedValue = Number.parseFloat(rawValue)

  if (!Number.isFinite(parsedValue)) {
    return fallback
  }

  return Math.min(1, Math.max(0, parsedValue))
}

/**
 * 统一解析 API 遥测配置，避免入口文件直接散落环境变量读取逻辑。
 */
export function resolveApiTelemetryConfig(environment: NodeJS.ProcessEnv): ApiTelemetryConfig {
  const nodeEnv = environment.NODE_ENV ?? 'development'
  const defaultSampleRate = nodeEnv === 'production' ? 0.1 : 1

  return {
    environment: nodeEnv,
    otlpEndpoint: environment.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || null,
    sentryDsn: environment.SENTRY_DSN?.trim() || null,
    serviceName: environment.OTEL_SERVICE_NAME?.trim() || defaultServiceName,
    tracesSampleRate: parseSampleRate(environment.TELEMETRY_TRACES_SAMPLE_RATE, defaultSampleRate),
  }
}

function createDefaultTelemetryDependencies(): TelemetryBootstrapDependencies {
  return {
    createNodeSdk: (configuration) => new NodeSDK(configuration),
    createTraceExporter: (configuration) => new OTLPTraceExporter(configuration),
    getAutoInstrumentations: getNodeAutoInstrumentations,
    initSentry: Sentry.init,
  }
}

/**
 * 初始化 API 运行时的 Sentry 与 OpenTelemetry。
 *
 * 约束：
 * - 仅在显式配置对应环境变量时启用
 * - 初始化失败只会把状态标记为 `error`，不会阻断主服务启动
 */
export function initializeTelemetry(
  config: ApiTelemetryConfig = resolveApiTelemetryConfig(process.env),
  dependencies: TelemetryBootstrapDependencies = createDefaultTelemetryDependencies(),
): ApiTelemetryRuntimeState {
  if (cachedTelemetryState) {
    return cachedTelemetryState
  }

  const issues: string[] = []
  let sentry: DependencyHealthStatus = 'unknown'
  let openTelemetry: DependencyHealthStatus = 'unknown'

  if (config.sentryDsn) {
    try {
      dependencies.initSentry({
        dsn: config.sentryDsn,
        environment: config.environment,
        profilesSampleRate: config.tracesSampleRate,
        tracesSampleRate: config.tracesSampleRate,
      })
      sentry = 'ok'
    } catch (error) {
      sentry = 'error'
      issues.push(
        `Failed to initialize Sentry: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (config.otlpEndpoint) {
    try {
      const sdk = dependencies.createNodeSdk({
        instrumentations: [dependencies.getAutoInstrumentations()],
        serviceName: config.serviceName,
        traceExporter: dependencies.createTraceExporter({
          url: config.otlpEndpoint,
        }),
      })

      sdk.start()
      openTelemetry = 'ok'
    } catch (error) {
      openTelemetry = 'error'
      issues.push(
        `Failed to initialize OpenTelemetry: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  for (const issue of issues) {
    console.error(`[telemetry] ${issue}`)
  }

  cachedTelemetryState = {
    issues,
    openTelemetry,
    sentry,
    serviceName: config.serviceName,
  }

  return cachedTelemetryState
}

/**
 * 读取当前 API 遥测状态。
 *
 * 如果入口尚未显式调用初始化，这里会做一次惰性初始化，保证健康检查始终可读。
 */
export function getTelemetryRuntimeState(): ApiTelemetryRuntimeState {
  return cachedTelemetryState ?? initializeTelemetry()
}

/**
 * 仅供测试重置遥测单例缓存，避免用例之间互相污染。
 */
export function resetTelemetryRuntimeStateForTests(): void {
  cachedTelemetryState = null
}
