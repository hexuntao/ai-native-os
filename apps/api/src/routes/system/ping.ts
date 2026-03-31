import { z } from 'zod'

import { publicProcedure } from '@/orpc/procedures'

export const pingProcedure = publicProcedure
  .route({
    method: 'GET',
    path: '/api/v1/system/ping',
    tags: ['System:Ping'],
    summary: 'Ping API service',
    description: 'Minimal readiness endpoint exposed through oRPC.',
  })
  .output(
    z.object({
      ok: z.literal(true),
      service: z.literal('api'),
      timestamp: z.string().datetime(),
    }),
  )
  .handler(() => ({
    ok: true,
    service: 'api',
    timestamp: new Date().toISOString(),
  }))
