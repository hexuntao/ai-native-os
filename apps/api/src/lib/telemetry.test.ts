import assert from 'node:assert/strict'
import test from 'node:test'

import {
  initializeTelemetry,
  resetTelemetryRuntimeStateForTests,
  resolveApiTelemetryConfig,
  type TelemetryBootstrapDependencies,
  type TelemetryTraceExporter,
} from './telemetry'

test('resolveApiTelemetryConfig normalizes telemetry environment values', () => {
  const config = resolveApiTelemetryConfig({
    NODE_ENV: 'production',
    OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.com/v1/traces',
    OTEL_SERVICE_NAME: 'custom-api',
    SENTRY_DSN: 'https://sentry.example.com/123',
    TELEMETRY_TRACES_SAMPLE_RATE: '0.25',
  })

  assert.equal(config.environment, 'production')
  assert.equal(config.otlpEndpoint, 'https://otel.example.com/v1/traces')
  assert.equal(config.sentryDsn, 'https://sentry.example.com/123')
  assert.equal(config.serviceName, 'custom-api')
  assert.equal(config.tracesSampleRate, 0.25)
})

test('initializeTelemetry enables configured backends through injected dependencies', () => {
  resetTelemetryRuntimeStateForTests()

  let nodeSdkStarts = 0
  let sentryInitializations = 0
  let exporterUrl: string | null = null
  const dependencies: TelemetryBootstrapDependencies = {
    createNodeSdk: (configuration) => {
      exporterUrl = (configuration.traceExporter as { url?: string } | undefined)?.url ?? null

      return {
        async shutdown() {},
        start() {
          nodeSdkStarts += 1
        },
      }
    },
    createTraceExporter: (configuration) =>
      ({
        export() {},
        async shutdown() {},
        url: configuration?.url,
      }) as unknown as TelemetryTraceExporter,
    getAutoInstrumentations: () => [],
    initSentry: () => {
      sentryInitializations += 1

      return undefined
    },
  }

  const telemetryState = initializeTelemetry(
    {
      environment: 'production',
      otlpEndpoint: 'https://otel.example.com/v1/traces',
      sentryDsn: 'https://sentry.example.com/123',
      serviceName: 'ai-native-os-api',
      tracesSampleRate: 0.1,
    },
    dependencies,
  )
  const telemetryStateAgain = initializeTelemetry(
    {
      environment: 'production',
      otlpEndpoint: 'https://ignored.example.com',
      sentryDsn: 'https://ignored.example.com',
      serviceName: 'ignored',
      tracesSampleRate: 0.9,
    },
    dependencies,
  )

  assert.equal(telemetryState.openTelemetry, 'ok')
  assert.equal(telemetryState.sentry, 'ok')
  assert.equal(telemetryState.issues.length, 0)
  assert.equal(nodeSdkStarts, 1)
  assert.equal(sentryInitializations, 1)
  assert.equal(exporterUrl, 'https://otel.example.com/v1/traces')
  assert.equal(telemetryStateAgain, telemetryState)

  resetTelemetryRuntimeStateForTests()
})
