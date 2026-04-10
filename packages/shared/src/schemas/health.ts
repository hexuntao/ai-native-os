import { z } from 'zod'

import { aiRuntimeCapabilitySchema } from './ai-runtime'

export const healthCheckStatusSchema = z.enum(['ok', 'error', 'degraded', 'unknown'])
export const dependencyHealthStatusSchema = z.enum(['ok', 'error', 'unknown'])

export const telemetryHealthSchema = z.object({
  openTelemetry: dependencyHealthStatusSchema,
  sentry: dependencyHealthStatusSchema,
})

export const healthResponseSchema = z.object({
  status: healthCheckStatusSchema,
  checks: z.object({
    api: z.literal('ok'),
    ai: aiRuntimeCapabilitySchema,
    database: dependencyHealthStatusSchema,
    redis: dependencyHealthStatusSchema,
    telemetry: telemetryHealthSchema,
  }),
  timestamp: z.string().datetime(),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
export type HealthCheckStatus = z.infer<typeof healthCheckStatusSchema>
export type DependencyHealthStatus = z.infer<typeof dependencyHealthStatusSchema>
export type TelemetryHealth = z.infer<typeof telemetryHealthSchema>
