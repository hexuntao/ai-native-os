import { withOpenApiSchemaDoc } from '@ai-native-os/shared'
import { z } from 'zod'

import { publicProcedure } from '@/orpc/procedures'

const pingResponseSchema = withOpenApiSchemaDoc(
  z.object({
    ok: withOpenApiSchemaDoc(z.literal(true), {
      title: 'PingOk',
      description: 'Ping 成功标志，固定为 `true`。',
      examples: [true],
    }),
    service: withOpenApiSchemaDoc(z.literal('api'), {
      title: 'PingService',
      description: '当前响应服务标识。',
      examples: ['api'],
    }),
    timestamp: withOpenApiSchemaDoc(z.string().datetime(), {
      title: 'PingTimestamp',
      description: '服务端生成响应时的时间戳。',
      examples: ['2026-04-11T07:00:00.000Z'],
    }),
  }),
  {
    title: 'PingResponse',
    description: 'API 就绪探针响应。',
    examples: [
      {
        ok: true,
        service: 'api',
        timestamp: '2026-04-11T07:00:00.000Z',
      },
    ],
  },
)

export const pingProcedure = publicProcedure
  .route({
    method: 'GET',
    path: '/api/v1/system/ping',
    tags: ['System:Ping'],
    summary: 'Ping API 服务',
    description: '通过 oRPC 暴露的最小就绪探针，用于验证 API 主链路可达。',
  })
  .output(pingResponseSchema)
  .handler(() => ({
    ok: true,
    service: 'api',
    timestamp: new Date().toISOString(),
  }))
