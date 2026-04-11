import { serializedAbilityResponseSchema } from '@ai-native-os/shared'

import { protectedProcedure } from '@/orpc/procedures'

export const currentAbilityProcedure = protectedProcedure
  .route({
    method: 'GET',
    path: '/api/v1/system/permissions/ability',
    tags: ['System:Permissions'],
    summary: '读取当前序列化 Ability',
    description: '返回供前端反序列化的 CASL ability 规则载荷。',
  })
  .output(serializedAbilityResponseSchema)
  .handler(({ context }) => ({
    roleCodes: context.roleCodes,
    rules: context.permissionRules,
    userId: context.userId,
  }))
