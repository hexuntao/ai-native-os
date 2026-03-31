import { z } from 'zod'

export const healthCheckStatusSchema = z.enum(['ok', 'error', 'degraded', 'unknown'])

export const healthResponseSchema = z.object({
  status: healthCheckStatusSchema,
  checks: z.object({
    api: healthCheckStatusSchema,
    database: healthCheckStatusSchema,
    redis: healthCheckStatusSchema,
  }),
  timestamp: z.string().datetime(),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
