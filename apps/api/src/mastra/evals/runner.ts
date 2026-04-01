import {
  countAiEvalRuns,
  listLatestAiEvalRunsByEvalKeys,
  type PersistAiEvalRunInput,
  persistAiEvalRun,
} from '@ai-native-os/db'
import type { AiEvalItemScoreMap, AiEvalRunStatus, AiEvalTriggerSource } from '@ai-native-os/shared'
import type { Dataset } from '@mastra/core/datasets'
import { Mastra } from '@mastra/core/mastra'
import { type DatasetItem, type DatasetRecord, InMemoryStore } from '@mastra/core/storage'

import {
  getMastraEvalScorerRegistry,
  getMastraEvalSuiteById,
  listMastraEvalSuites,
} from './registry'
import { buildEvalRunScoreStats, type MastraEvalSeedItem, type MastraEvalSuite } from './types'

export interface MastraEvalRunRequest {
  actorAuthUserId: string
  actorRbacUserId: string | null
  evalId: string
  requestId: string
  triggerSource: AiEvalTriggerSource
}

export interface MastraEvalRunOutcome {
  completedAt: string | null
  datasetId: string
  datasetName: string
  evalId: string
  evalName: string
  experimentId: string
  requestId: string | null
  scoreAverage: number | null
  status: AiEvalRunStatus
  totalItems: number
}

export interface MastraEvalCatalogEntry {
  datasetSize: number
  id: string
  lastRunAt: string | null
  lastRunAverageScore: number | null
  lastRunStatus: AiEvalRunStatus | null
  name: string
  notes: string
  scorerCount: number
  status: 'not_configured' | 'registered'
}

export interface MastraEvalCatalogSnapshot {
  configured: boolean
  entries: MastraEvalCatalogEntry[]
  reason: string
  totalDatasets: number
  totalExperiments: number
}

const mastraEvalRuntime = new Mastra({
  scorers: getMastraEvalScorerRegistry(),
  storage: new InMemoryStore({
    id: 'mastra-eval-runtime',
  }),
})

function normalizeDatasetItems(
  value:
    | DatasetItem[]
    | {
        items: DatasetItem[]
      },
): DatasetItem[] {
  if (Array.isArray(value)) {
    return value
  }

  return value.items
}

async function findDatasetRecordByName(name: string): Promise<DatasetRecord | null> {
  const listed = await mastraEvalRuntime.datasets.list({
    page: 0,
    perPage: 100,
  })

  return listed.datasets.find((dataset) => dataset.name === name) ?? null
}

async function readDatasetItems(dataset: Dataset): Promise<DatasetItem[]> {
  const listed = await dataset.listItems({
    page: 0,
    perPage: 200,
  })

  return normalizeDatasetItems(listed)
}

function createDatasetSeedInput(item: MastraEvalSeedItem): {
  groundTruth?: unknown
  input: unknown
  metadata?: Record<string, unknown>
  requestContext?: Record<string, unknown>
} {
  const seedInput: {
    groundTruth?: unknown
    input: unknown
    metadata?: Record<string, unknown>
    requestContext?: Record<string, unknown>
  } = {
    input: item.input,
  }

  if (item.groundTruth !== undefined) {
    seedInput.groundTruth = item.groundTruth
  }

  if (item.metadata !== undefined) {
    seedInput.metadata = item.metadata
  }

  if (item.requestContext !== undefined) {
    seedInput.requestContext = item.requestContext
  }

  return seedInput
}

/**
 * 确保评估套件对应的数据集存在，并带有基准评估样本。
 */
async function ensureSuiteDataset(
  suite: MastraEvalSuite,
): Promise<{ dataset: Dataset; datasetSize: number }> {
  const datasetRecord = await findDatasetRecordByName(suite.datasetName)

  if (!datasetRecord) {
    const createdDataset = await mastraEvalRuntime.datasets.create({
      description: suite.datasetDescription,
      name: suite.datasetName,
      scorerIds: suite.scorers.map((scorer) => scorer.id),
      targetIds: [suite.targetId],
      targetType: suite.targetType,
    })

    await createdDataset.addItems({
      items: suite.seedItems.map(createDatasetSeedInput),
    })

    const createdItems = await readDatasetItems(createdDataset)

    return {
      dataset: createdDataset,
      datasetSize: createdItems.length,
    }
  }

  const existingDataset = await mastraEvalRuntime.datasets.get({
    id: datasetRecord.id,
  })
  const existingItems = await readDatasetItems(existingDataset)

  if (existingItems.length === 0) {
    await existingDataset.addItems({
      items: suite.seedItems.map(createDatasetSeedInput),
    })

    const seededItems = await readDatasetItems(existingDataset)

    return {
      dataset: existingDataset,
      datasetSize: seededItems.length,
    }
  }

  return {
    dataset: existingDataset,
    datasetSize: existingItems.length,
  }
}

type SuiteExperimentSummary = Awaited<ReturnType<Dataset['startExperiment']>>

function collectScorerScores(summary: SuiteExperimentSummary): Record<string, number[]> {
  const scorerScores: Record<string, number[]> = {}

  for (const item of summary.results) {
    for (const score of item.scores) {
      if (score.score === null) {
        continue
      }

      if (!scorerScores[score.scorerId]) {
        scorerScores[score.scorerId] = []
      }

      scorerScores[score.scorerId]?.push(score.score)
    }
  }

  return scorerScores
}

function createItemScoreMap(item: SuiteExperimentSummary['results'][number]): AiEvalItemScoreMap {
  const scoreMap: AiEvalItemScoreMap = {}

  for (const score of item.scores) {
    scoreMap[score.scorerId] = {
      error: score.error,
      reason: score.reason,
      score: score.score,
    }
  }

  return scoreMap
}

function extractRequestIdFromOutput(output: unknown): string | null {
  if (typeof output !== 'object' || output === null) {
    return null
  }

  const requestId = (output as { requestId?: unknown }).requestId

  return typeof requestId === 'string' ? requestId : null
}

function mapPersistInput(args: {
  request: MastraEvalRunRequest
  suite: MastraEvalSuite
  datasetId: string
  datasetName: string
  summary: SuiteExperimentSummary
}): PersistAiEvalRunInput {
  const scorerScores = collectScorerScores(args.summary)
  const scoreStats = buildEvalRunScoreStats(scorerScores)
  const propagatedRequestId =
    args.summary.results.map((item) => extractRequestIdFromOutput(item.output)).find(Boolean) ??
    args.request.requestId

  return {
    actorAuthUserId: args.request.actorAuthUserId,
    actorRbacUserId: args.request.actorRbacUserId,
    completedAt: args.summary.completedAt,
    datasetId: args.datasetId,
    datasetName: args.datasetName,
    evalKey: args.suite.id,
    evalName: args.suite.name,
    experimentId: args.summary.experimentId,
    failedCount: args.summary.failedCount,
    items: args.summary.results.map((item, index) => ({
      datasetItemId: item.itemId,
      errorMessage: item.error?.message ?? null,
      groundTruth: item.groundTruth,
      input: item.input,
      itemIndex: index,
      output: item.output,
      scores: createItemScoreMap(item),
    })),
    requestId: propagatedRequestId,
    scoreAverage: scoreStats.averageScore,
    scoreMax: scoreStats.maxScore,
    scoreMin: scoreStats.minScore,
    scorerSummary: scoreStats.scorerSummary,
    skippedCount: args.summary.skippedCount,
    startedAt: args.summary.startedAt,
    status: args.summary.status,
    succeededCount: args.summary.succeededCount,
    totalItems: args.summary.totalItems,
    triggerSource: args.request.triggerSource,
  }
}

async function runSuite(
  suite: MastraEvalSuite,
  request: MastraEvalRunRequest,
): Promise<MastraEvalRunOutcome> {
  const { dataset, datasetSize } = await ensureSuiteDataset(suite)
  const summary = await dataset.startExperiment({
    description: `Baseline runner for ${suite.id}`,
    maxConcurrency: 1,
    name: `${suite.id}-${new Date().toISOString()}`,
    scorers: [...suite.scorers],
    task: async ({ input }) => suite.execute(input, { triggerSource: request.triggerSource }),
  })
  const persisted = await persistAiEvalRun(
    mapPersistInput({
      datasetId: dataset.id,
      datasetName: suite.datasetName,
      request,
      suite,
      summary,
    }),
  )

  return {
    completedAt: persisted.completedAt?.toISOString() ?? null,
    datasetId: persisted.datasetId,
    datasetName: persisted.datasetName,
    evalId: suite.id,
    evalName: suite.name,
    experimentId: persisted.experimentId,
    requestId: persisted.requestId,
    scoreAverage: persisted.scoreAverage,
    status: persisted.status,
    totalItems: datasetSize,
  }
}

/**
 * 执行单个评估套件，并把实验结果持久化到项目数据库。
 */
export async function runMastraEvalSuite(
  request: MastraEvalRunRequest,
): Promise<MastraEvalRunOutcome> {
  const suite = getMastraEvalSuiteById(request.evalId)

  if (!suite) {
    throw new Error(`Unknown mastra eval suite: ${request.evalId}`)
  }

  return runSuite(suite, request)
}

/**
 * 顺序执行全部评估套件，避免并发运行带来资源竞争与审计归因混乱。
 */
export async function runAllMastraEvalSuites(
  request: Omit<MastraEvalRunRequest, 'evalId'>,
): Promise<MastraEvalRunOutcome[]> {
  const runResults: MastraEvalRunOutcome[] = []

  for (const suite of listMastraEvalSuites()) {
    const runResult = await runSuite(suite, {
      ...request,
      evalId: suite.id,
    })

    runResults.push(runResult)
  }

  return runResults
}

/**
 * 构建评估目录快照，供 API 列表和前端页面显示最新配置与运行状态。
 */
export async function buildMastraEvalCatalogSnapshot(): Promise<MastraEvalCatalogSnapshot> {
  const suites = listMastraEvalSuites()
  const latestRunMap = await listLatestAiEvalRunsByEvalKeys(suites.map((suite) => suite.id))
  const entries: MastraEvalCatalogEntry[] = []

  for (const suite of suites) {
    const datasetRecord = await findDatasetRecordByName(suite.datasetName)
    const latestRun = latestRunMap.get(suite.id)
    let datasetSize = 0
    let status: MastraEvalCatalogEntry['status'] = 'not_configured'

    if (datasetRecord) {
      const dataset = await mastraEvalRuntime.datasets.get({
        id: datasetRecord.id,
      })
      const datasetItems = await readDatasetItems(dataset)

      datasetSize = datasetItems.length
      status = 'registered'
    }

    entries.push({
      datasetSize,
      id: suite.id,
      lastRunAt: latestRun?.completedAt?.toISOString() ?? null,
      lastRunAverageScore: latestRun?.scoreAverage ?? null,
      lastRunStatus: latestRun?.status ?? null,
      name: suite.name,
      notes: suite.notes,
      scorerCount: suite.scorers.length,
      status,
    })
  }

  const configured = entries.every((entry) => entry.status === 'registered')

  return {
    configured,
    entries,
    reason: configured
      ? 'Mastra eval suites are configured and persisted run results are available.'
      : 'Some eval suites have no registered dataset yet. Run the eval runner to initialize them.',
    totalDatasets: entries.filter((entry) => entry.status === 'registered').length,
    totalExperiments: await countAiEvalRuns(),
  }
}
