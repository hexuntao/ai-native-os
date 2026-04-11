import { z } from 'zod'

import { withOpenApiSchemaDoc } from './openapi-doc'

export const aiEvalRunStatusSchema = withOpenApiSchemaDoc(
  z.enum(['completed', 'failed', 'pending', 'running']),
  {
    title: 'AiEvalRunStatus',
    description: '评测运行状态，表示当前实验执行阶段或最终结果。',
    examples: ['completed', 'failed', 'pending', 'running'],
  },
)

export const aiEvalTriggerSourceSchema = withOpenApiSchemaDoc(
  z.enum(['manual', 'schedule', 'test']),
  {
    title: 'AiEvalTriggerSource',
    description: '触发评测的来源，分别表示手动运行、计划任务运行或测试运行。',
    examples: ['manual', 'schedule', 'test'],
  },
)

export const aiEvalScorerAggregateSchema = withOpenApiSchemaDoc(
  z.object({
    averageScore: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiEvalAverageScore',
      description: '该评分器在当前评测运行中的平均分；没有样本时为 `null`。',
      examples: [0.91],
    }),
    maxScore: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiEvalMaxScore',
      description: '该评分器在当前评测运行中的最高分；没有样本时为 `null`。',
      examples: [1],
    }),
    minScore: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiEvalMinScore',
      description: '该评分器在当前评测运行中的最低分；没有样本时为 `null`。',
      examples: [0.72],
    }),
    sampleCount: withOpenApiSchemaDoc(z.number().int().min(0), {
      title: 'AiEvalSampleCount',
      description: '该评分器参与统计的样本数。',
      examples: [12],
    }),
  }),
  {
    title: 'AiEvalScorerAggregate',
    description: '单个评分器在一次评测运行中的聚合统计。',
    examples: [
      {
        averageScore: 0.91,
        maxScore: 1,
        minScore: 0.72,
        sampleCount: 12,
      },
    ],
  },
)

export const aiEvalScorerSummarySchema = withOpenApiSchemaDoc(
  z.record(z.string(), aiEvalScorerAggregateSchema),
  {
    title: 'AiEvalScorerSummary',
    description: '以评分器名称为键的评测汇总映射，用于记录每个评分器的聚合结果。',
    examples: [
      {
        relevance: {
          averageScore: 0.91,
          maxScore: 1,
          minScore: 0.72,
          sampleCount: 12,
        },
      },
    ],
  },
)

export const aiEvalItemScoreSchema = withOpenApiSchemaDoc(
  z.object({
    error: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiEvalItemError',
      description: '评分失败时的错误信息；正常完成时为 `null`。',
      examples: [null],
    }),
    reason: withOpenApiSchemaDoc(z.string().nullable(), {
      title: 'AiEvalItemReason',
      description: '评分器返回的解释说明；未提供时为 `null`。',
      examples: ['答案覆盖了 4 个目标字段。'],
    }),
    score: withOpenApiSchemaDoc(z.number().min(0).max(1).nullable(), {
      title: 'AiEvalItemScore',
      description: '当前样本在该评分器下的分数；失败时为 `null`。',
      examples: [0.88],
    }),
  }),
  {
    title: 'AiEvalItemScoreEntry',
    description: '单个样本在一个评分器下的详细评分结果。',
    examples: [
      {
        error: null,
        reason: '答案覆盖了 4 个目标字段。',
        score: 0.88,
      },
    ],
  },
)

export const aiEvalItemScoreMapSchema = withOpenApiSchemaDoc(
  z.record(z.string(), aiEvalItemScoreSchema),
  {
    title: 'AiEvalItemScoreMap',
    description: '以评分器名称为键的单样本评分明细映射。',
    examples: [
      {
        factuality: {
          error: null,
          reason: '关键事实与参考答案一致。',
          score: 0.94,
        },
      },
    ],
  },
)

export type AiEvalRunStatus = z.infer<typeof aiEvalRunStatusSchema>
export type AiEvalTriggerSource = z.infer<typeof aiEvalTriggerSourceSchema>
export type AiEvalScorerAggregate = z.infer<typeof aiEvalScorerAggregateSchema>
export type AiEvalScorerSummary = z.infer<typeof aiEvalScorerSummarySchema>
export type AiEvalItemScore = z.infer<typeof aiEvalItemScoreSchema>
export type AiEvalItemScoreMap = z.infer<typeof aiEvalItemScoreMapSchema>
