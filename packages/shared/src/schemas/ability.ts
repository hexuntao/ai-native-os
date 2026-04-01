import { z } from 'zod'

import { appActions, appSubjects } from '../abilities/subjects'

export const permissionConditionsSchema = z.record(z.string(), z.unknown()).nullable().optional()

export const permissionRuleSchema = z.object({
  action: z.enum(appActions),
  conditions: permissionConditionsSchema,
  fields: z.array(z.string()).optional(),
  inverted: z.boolean().optional(),
  subject: z.enum(appSubjects),
})

export const permissionRuleListSchema = z.array(permissionRuleSchema)

export const currentPermissionsResponseSchema = z.object({
  permissionRules: permissionRuleListSchema,
  rbacUserId: z.string().uuid().nullable(),
  roleCodes: z.array(z.string()),
  userId: z.string(),
})

export const serializedAbilityResponseSchema = z.object({
  roleCodes: z.array(z.string()),
  rules: permissionRuleListSchema,
  userId: z.string(),
})
