import { aiToolCatalogResponseSchema } from '@ai-native-os/shared'

import { getMastraToolCatalog } from '@/mastra/tools'
import { protectedProcedure } from '@/orpc/procedures'

export const aiToolCatalogProcedure = protectedProcedure
  .route({
    method: 'GET',
    path: '/api/v1/system/ai/tools/catalog',
    tags: ['System:AI'],
    summary: '读取 AI Tool 目录',
    description: '返回当前已注册的 Mastra Tool 目录，以及当前主体在本次请求上下文中的可用性。',
  })
  .output(aiToolCatalogResponseSchema)
  .handler(({ context }) => ({
    tools: getMastraToolCatalog(context.ability),
  }))
