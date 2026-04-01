import { z } from 'zod'

export const aiEvalRunStatusSchema = z.enum(['completed', 'failed', 'pending', 'running'])

export const aiEvalTriggerSourceSchema = z.enum(['manual', 'schedule', 'test'])

export const aiEvalScorerAggregateSchema = z.object({
  averageScore: z.number().min(0).max(1).nullable(),
  maxScore: z.number().min(0).max(1).nullable(),
  minScore: z.number().min(0).max(1).nullable(),
  sampleCount: z.number().int().min(0),
})

export const aiEvalScorerSummarySchema = z.record(z.string(), aiEvalScorerAggregateSchema)

export const aiEvalItemScoreSchema = z.object({
  error: z.string().nullable(),
  reason: z.string().nullable(),
  score: z.number().min(0).max(1).nullable(),
})

export const aiEvalItemScoreMapSchema = z.record(z.string(), aiEvalItemScoreSchema)

export type AiEvalRunStatus = z.infer<typeof aiEvalRunStatusSchema>
export type AiEvalTriggerSource = z.infer<typeof aiEvalTriggerSourceSchema>
export type AiEvalScorerAggregate = z.infer<typeof aiEvalScorerAggregateSchema>
export type AiEvalScorerSummary = z.infer<typeof aiEvalScorerSummarySchema>
export type AiEvalItemScore = z.infer<typeof aiEvalItemScoreSchema>
export type AiEvalItemScoreMap = z.infer<typeof aiEvalItemScoreMapSchema>
