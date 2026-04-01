import { z } from 'zod'

import { aiEvalRunStatusSchema, aiEvalScorerSummarySchema } from './ai-evals'
import { paginatedResponseSchema } from './common'

const promptKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(
    /^[a-z0-9._-]+$/,
    'promptKey must use lowercase letters, numbers, dot, underscore, or hyphen',
  )

const queryPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
})

export const promptVersionStatusSchema = z.enum(['active', 'archived', 'draft'])

export const promptReleasePolicySchema = z.object({
  minAverageScore: z.number().min(0).max(1).default(0.8),
  scorerThresholds: z.record(z.string(), z.number().min(0).max(1)).default({}),
})

export const promptEvalEvidenceSchema = z.object({
  completedAt: z.string().nullable(),
  evalKey: z.string(),
  evalRunId: z.string().uuid(),
  experimentId: z.string(),
  scoreAverage: z.number().min(0).max(1).nullable(),
  scorerSummary: aiEvalScorerSummarySchema,
  status: aiEvalRunStatusSchema,
})

export const promptVersionEntrySchema = z.object({
  activatedAt: z.string().nullable(),
  activatedByAuthUserId: z.string().nullable(),
  activatedByRbacUserId: z.string().uuid().nullable(),
  createdAt: z.string(),
  createdByAuthUserId: z.string(),
  createdByRbacUserId: z.string().uuid().nullable(),
  evalEvidence: promptEvalEvidenceSchema.nullable(),
  id: z.string().uuid(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  promptKey: promptKeySchema,
  promptText: z.string(),
  releasePolicy: promptReleasePolicySchema,
  releaseReady: z.boolean(),
  releaseReason: z.string().nullable(),
  rolledBackFromVersionId: z.string().uuid().nullable(),
  status: promptVersionStatusSchema,
  updatedAt: z.string(),
  version: z.number().int().min(1),
})

export const promptVersionListInputSchema = queryPaginationSchema.extend({
  promptKey: promptKeySchema.optional(),
  status: promptVersionStatusSchema.optional(),
})

export const promptVersionListResponseSchema = paginatedResponseSchema(
  promptVersionEntrySchema,
).extend({
  summary: z.object({
    activeCount: z.number().int().min(0),
    draftCount: z.number().int().min(0),
    releaseReadyCount: z.number().int().min(0),
  }),
})

export const createPromptVersionInputSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  promptKey: promptKeySchema,
  promptText: z.string().trim().min(1),
  releasePolicy: promptReleasePolicySchema.default({
    minAverageScore: 0.8,
    scorerThresholds: {},
  }),
})

export const attachPromptEvalEvidenceInputSchema = z.object({
  evalRunId: z.string().uuid(),
  promptVersionId: z.string().uuid(),
})

export const activatePromptVersionInputSchema = z.object({
  promptVersionId: z.string().uuid(),
})

export const rollbackPromptVersionInputSchema = z.object({
  promptKey: promptKeySchema,
  targetVersionId: z.string().uuid().optional(),
})

export type PromptVersionStatus = z.infer<typeof promptVersionStatusSchema>
export type PromptReleasePolicy = z.infer<typeof promptReleasePolicySchema>
export type PromptEvalEvidence = z.infer<typeof promptEvalEvidenceSchema>
export type PromptVersionEntry = z.infer<typeof promptVersionEntrySchema>
export type PromptVersionListInput = z.infer<typeof promptVersionListInputSchema>
export type PromptVersionListResponse = z.infer<typeof promptVersionListResponseSchema>
export type CreatePromptVersionInput = z.infer<typeof createPromptVersionInputSchema>
export type AttachPromptEvalEvidenceInput = z.infer<typeof attachPromptEvalEvidenceInputSchema>
export type ActivatePromptVersionInput = z.infer<typeof activatePromptVersionInputSchema>
export type RollbackPromptVersionInput = z.infer<typeof rollbackPromptVersionInputSchema>
