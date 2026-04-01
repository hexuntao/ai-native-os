import { z } from 'zod'

import { appActions, appSubjects } from '../abilities/subjects'
import { aiFeedbackUserActionSchema } from './ai-feedback'

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
  feedbackCount: z.number().int().min(0),
  humanOverride: z.boolean(),
  id: z.string().uuid(),
  latestFeedbackAt: z.string().nullable(),
  latestUserAction: aiFeedbackUserActionSchema.nullable(),
  requestId: z.string().nullable(),
  roleCodes: z.array(z.string()),
  status: z.enum(['error', 'forbidden', 'success']),
  subject: z.enum(appSubjects),
  toolId: z.string(),
})

export const aiAuditLogListResponseSchema = z.object({
  logs: z.array(aiAuditLogEntrySchema),
})
