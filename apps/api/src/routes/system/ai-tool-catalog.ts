import { aiToolCatalogResponseSchema } from '@ai-native-os/shared'

import { getMastraToolCatalog } from '@/mastra/tools'
import { protectedProcedure } from '@/orpc/procedures'

export const aiToolCatalogProcedure = protectedProcedure
  .route({
    method: 'GET',
    path: '/api/v1/system/ai/tools/catalog',
    tags: ['System:AI'],
    summary: 'List AI runtime tools and their current RBAC availability',
    description:
      'Returns the registered Mastra tool catalog and whether the current user can use each tool.',
  })
  .output(aiToolCatalogResponseSchema)
  .handler(({ context }) => ({
    tools: getMastraToolCatalog(context.ability),
  }))
