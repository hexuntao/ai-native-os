import { z } from 'zod'

import { appActions, appSubjects } from '../abilities/subjects'

export const aiToolPermissionSchema = z.object({
  action: z.enum(appActions),
  subject: z.enum(appSubjects),
})

export const aiToolCatalogItemSchema = z.object({
  description: z.string(),
  enabled: z.boolean(),
  id: z.string(),
  permission: aiToolPermissionSchema,
})

export const aiToolCatalogResponseSchema = z.object({
  tools: z.array(aiToolCatalogItemSchema),
})

export const aiAuditLogEntrySchema = z.object({
  action: z.enum(appActions),
  actorAuthUserId: z.string(),
  actorRbacUserId: z.string().uuid().nullable(),
  createdAt: z.string(),
  errorMessage: z.string().nullable(),
  id: z.string().uuid(),
  requestId: z.string().nullable(),
  roleCodes: z.array(z.string()),
  status: z.enum(['error', 'forbidden', 'success']),
  subject: z.enum(appSubjects),
  toolId: z.string(),
})

export const aiAuditLogListResponseSchema = z.object({
  logs: z.array(aiAuditLogEntrySchema),
})
