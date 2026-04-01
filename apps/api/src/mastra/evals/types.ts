import type {
  AiEvalScorerAggregate,
  AiEvalScorerSummary,
  AiEvalTriggerSource,
} from '@ai-native-os/shared'
import type { MastraScorer } from '@mastra/core/evals'

export interface MastraEvalSeedItem {
  groundTruth?: unknown
  input: unknown
  metadata?: Record<string, unknown>
  requestContext?: Record<string, unknown>
}

export interface MastraEvalSuiteContext {
  triggerSource: AiEvalTriggerSource
}

export interface MastraEvalSuite {
  datasetDescription: string
  datasetName: string
  execute: (input: unknown, context: MastraEvalSuiteContext) => Promise<unknown>
  id: string
  name: string
  notes: string
  scorerThresholds: Readonly<Record<string, number>>
  scorers: readonly MastraScorer<string, unknown, unknown, Record<string, unknown>>[]
  seedItems: readonly MastraEvalSeedItem[]
  targetId: string
  targetType: 'workflow'
}

export interface MastraEvalRunScoreStats {
  averageScore: number | null
  maxScore: number | null
  minScore: number | null
  scorerSummary: AiEvalScorerSummary
}

function toScoreAggregate(scores: number[]): AiEvalScorerAggregate {
  if (scores.length === 0) {
    return {
      averageScore: null,
      maxScore: null,
      minScore: null,
      sampleCount: 0,
    }
  }

  const total = scores.reduce((sum, score) => sum + score, 0)

  return {
    averageScore: total / scores.length,
    maxScore: Math.max(...scores),
    minScore: Math.min(...scores),
    sampleCount: scores.length,
  }
}

/**
 * 把实验结果中的 scorer 分数归并成可持久化的聚合统计。
 */
export function buildEvalRunScoreStats(
  scorerScores: Readonly<Record<string, number[]>>,
): MastraEvalRunScoreStats {
  const scorerSummary: AiEvalScorerSummary = {}
  const flattenedScores: number[] = []

  for (const [scorerId, scores] of Object.entries(scorerScores)) {
    scorerSummary[scorerId] = toScoreAggregate(scores)
    flattenedScores.push(...scores)
  }

  if (flattenedScores.length === 0) {
    return {
      averageScore: null,
      maxScore: null,
      minScore: null,
      scorerSummary,
    }
  }

  const totalScore = flattenedScores.reduce((sum, score) => sum + score, 0)

  return {
    averageScore: totalScore / flattenedScores.length,
    maxScore: Math.max(...flattenedScores),
    minScore: Math.min(...flattenedScores),
    scorerSummary,
  }
}
