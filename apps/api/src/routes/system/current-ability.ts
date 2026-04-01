import { serializedAbilityResponseSchema } from '@ai-native-os/shared'

import { protectedProcedure } from '@/orpc/procedures'

export const currentAbilityProcedure = protectedProcedure
  .route({
    method: 'GET',
    path: '/api/v1/system/permissions/ability',
    tags: ['System:Permissions'],
    summary: 'Get current serialized CASL ability',
    description: 'Returns the serialized CASL rules payload for frontend deserialization.',
  })
  .output(serializedAbilityResponseSchema)
  .handler(({ context }) => ({
    roleCodes: context.roleCodes,
    rules: context.permissionRules,
    userId: context.userId,
  }))
