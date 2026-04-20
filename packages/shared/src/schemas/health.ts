import { z } from 'zod'

import { aiRuntimeCapabilitySchema } from './ai-runtime'

export const healthCheckStatusSchema = z.enum(['ok', 'error', 'degraded', 'unknown'])
export const dependencyHealthStatusSchema = z.enum(['ok', 'error', 'unknown'])

export const dependencyProbeSchema = z.object({
  detail: z.string().min(1),
  status: dependencyHealthStatusSchema,
})

export const telemetryHealthSchema = z.object({
  openTelemetry: dependencyHealthStatusSchema,
  sentry: dependencyHealthStatusSchema,
})

export const triggerRuntimeHealthSchema = z.object({
  apiUrl: z.string().min(1).nullable(),
  projectRef: z.string().min(1).nullable(),
  projectRefConfigured: z.boolean(),
  secretKeyConfigured: z.boolean(),
  status: dependencyHealthStatusSchema,
})

export const healthResponseSchema = z.object({
  status: healthCheckStatusSchema,
  checks: z.object({
    api: z.literal('ok'),
    ai: aiRuntimeCapabilitySchema,
    database: dependencyHealthStatusSchema,
    jobs: dependencyProbeSchema,
    redis: dependencyHealthStatusSchema,
    telemetry: telemetryHealthSchema,
    trigger: triggerRuntimeHealthSchema,
    worker: dependencyProbeSchema,
  }),
  timestamp: z.string().datetime(),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
export type HealthCheckStatus = z.infer<typeof healthCheckStatusSchema>
export type DependencyHealthStatus = z.infer<typeof dependencyHealthStatusSchema>
export type DependencyProbe = z.infer<typeof dependencyProbeSchema>
export type TelemetryHealth = z.infer<typeof telemetryHealthSchema>
export type TriggerRuntimeHealth = z.infer<typeof triggerRuntimeHealthSchema>
