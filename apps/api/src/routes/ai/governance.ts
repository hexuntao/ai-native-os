import {
  listOperationLogsByModule,
  listPromptVersions,
  type OperationLogRecord,
} from '@ai-native-os/db'
import {
  type AiGovernanceLinkedEval,
  type AiGovernanceOverview,
  type AiGovernanceReviewAction,
  type AiGovernanceReviewItem,
  type AiGovernanceReviewTone,
  aiGovernanceOverviewSchema,
  type GetPromptGovernanceReviewInput,
  getPromptGovernanceReviewInputSchema,
  type ListAiGovernanceOverviewInput,
  listAiGovernanceOverviewInputSchema,
  type PromptGovernanceFailureKind,
  type PromptGovernanceReview,
  type PromptVersionEntry,
  promptGovernanceReviewSchema,
} from '@ai-native-os/shared'
import { ORPCError } from '@orpc/server'

import { requireAnyPermission } from '@/orpc/procedures'
import { listAiEvals } from '@/routes/ai/evals'
import { listFeedback } from '@/routes/ai/feedback'
import {
  getPromptGovernanceFailureAuditEntry,
  getPromptReleaseAuditEntry,
  getPromptRollbackChainEntry,
  getPromptVersionCompareEntry,
  getPromptVersionHistoryEntry,
} from '@/routes/ai/prompts'
import { createPagination, paginateArray } from '@/routes/lib/pagination'

const aiGovernanceReadPermissions = [
  { action: 'read', subject: 'AiAuditLog' },
  { action: 'manage', subject: 'AiKnowledge' },
  { action: 'manage', subject: 'all' },
] as const

interface PromptFailureAggregate {
  count: number
  latestAt: string | null
  latestKind: PromptGovernanceFailureKind | null
}

/**
 * 从 Prompt 操作日志中恢复 promptKey 级失败聚合，用于治理总览快速排序。
 */
function createPromptFailureAggregateMap(
  logs: readonly OperationLogRecord[],
): Map<string, PromptFailureAggregate> {
  const aggregateMap = new Map<string, PromptFailureAggregate>()

  for (const entry of logs) {
    if (entry.module !== 'ai_prompts' || entry.status !== 'error') {
      continue
    }

    const promptKey = entry.requestInfo?.promptKey

    if (!promptKey) {
      continue
    }

    const failureKind =
      entry.requestInfo?.failureKind === 'exception' || entry.action.endsWith('_exception')
        ? 'exception'
        : 'rejection'
    const currentAggregate = aggregateMap.get(promptKey) ?? {
      count: 0,
      latestAt: null,
      latestKind: null,
    }
    const createdAt = entry.createdAt.toISOString()

    aggregateMap.set(promptKey, {
      count: currentAggregate.count + 1,
      latestAt:
        currentAggregate.latestAt === null || createdAt > currentAggregate.latestAt
          ? createdAt
          : currentAggregate.latestAt,
      latestKind:
        currentAggregate.latestAt === null || createdAt >= currentAggregate.latestAt
          ? failureKind
          : currentAggregate.latestKind,
    })
  }

  return aggregateMap
}

/**
 * 统一根据 Prompt 最新状态、失败信号和人工 override 为 review queue 生成下一步动作。
 */
function resolveReviewDirective(input: {
  failureCount: number
  hasHumanOverride: boolean
  latestFailureKind: PromptGovernanceFailureKind | null
  latestVersion: PromptVersionEntry
}): {
  action: AiGovernanceReviewAction
  reason: string
  tone: AiGovernanceReviewTone
} {
  if (input.latestFailureKind === 'exception') {
    return {
      action: 'investigate_exception',
      reason: '最近一次治理失败属于运行时异常，优先检查工作流、依赖或运行环境。',
      tone: 'critical',
    }
  }

  if (input.hasHumanOverride) {
    return {
      action: 'review_override',
      reason: '最近存在人工 override，建议确认是否已经形成稳定规则，避免继续依赖临时接管。',
      tone: 'warning',
    }
  }

  if (input.latestVersion.evalEvidence === null) {
    return {
      action: 'attach_eval_evidence',
      reason: '当前版本尚未绑定评测证据，发布门禁无法给出可靠结论。',
      tone: input.failureCount > 0 ? 'warning' : 'neutral',
    }
  }

  if (!input.latestVersion.releaseReady) {
    return {
      action: 'review_release_gate',
      reason:
        input.latestVersion.releaseReason ?? '当前版本尚未满足发布门禁，建议先检查评测结果与阈值。',
      tone: 'warning',
    }
  }

  if (input.latestVersion.status === 'draft') {
    return {
      action: 'activate_ready_version',
      reason: '当前版本已满足发布门禁，但仍停留在草稿态，适合人工复核后激活。',
      tone: 'neutral',
    }
  }

  return {
    action: 'watch_stable',
    reason: '当前治理链路稳定，建议继续观察后续评测和人工反馈信号。',
    tone: 'neutral',
  }
}

/**
 * 把 Prompt 历史、失败与反馈信号压缩成 review queue 条目。
 */
function createGovernanceReviewItem(input: {
  failureAggregate: PromptFailureAggregate | null
  hasHumanOverride: boolean
  latestFeedbackAction: 'accepted' | 'edited' | 'overridden' | 'rejected' | null
  promptKey: string
  versions: readonly PromptVersionEntry[]
}): AiGovernanceReviewItem {
  const latestVersion = input.versions[0]
  const activeVersion = input.versions.find((entry) => entry.isActive) ?? null

  if (!latestVersion) {
    throw new Error(
      `Prompt governance review item requires at least one version for ${input.promptKey}`,
    )
  }

  const reviewDirective = resolveReviewDirective({
    failureCount: input.failureAggregate?.count ?? 0,
    hasHumanOverride: input.hasHumanOverride,
    latestFailureKind: input.failureAggregate?.latestKind ?? null,
    latestVersion,
  })

  return {
    activeVersionId: activeVersion?.id ?? null,
    failureCount: input.failureAggregate?.count ?? 0,
    hasHumanOverride: input.hasHumanOverride,
    latestFailureAt: input.failureAggregate?.latestAt ?? null,
    latestFailureKind: input.failureAggregate?.latestKind ?? null,
    latestFeedbackAction: input.latestFeedbackAction,
    latestVersion,
    promptKey: input.promptKey,
    releaseReadyCount: input.versions.filter((entry) => entry.releaseReady).length,
    reviewAction: reviewDirective.action,
    reviewReason: reviewDirective.reason,
    tone: reviewDirective.tone,
    totalVersions: input.versions.length,
  }
}

/**
 * 将 Prompt 列表收敛为按 promptKey 分组的稳定结构，供 overview/detail 复用。
 */
function groupPromptVersionsByPromptKey(
  versions: readonly PromptVersionEntry[],
): Map<string, PromptVersionEntry[]> {
  const groupedMap = new Map<string, PromptVersionEntry[]>()

  for (const version of versions) {
    const currentEntries = groupedMap.get(version.promptKey) ?? []
    currentEntries.push(version)
    groupedMap.set(version.promptKey, currentEntries)
  }

  for (const [, entries] of groupedMap) {
    entries.sort((left, right) => right.version - left.version)
  }

  return groupedMap
}

/**
 * 把评测目录快照映射到 Prompt 工作台可消费的绑定摘要。
 */
function createLinkedEvalSnapshot(input: {
  evalCatalog: Awaited<ReturnType<typeof listAiEvals>>
  latestVersion: PromptVersionEntry | null
}): AiGovernanceLinkedEval {
  const evalKey = input.latestVersion?.evalEvidence?.evalKey ?? null
  const matchingEval = evalKey
    ? (input.evalCatalog.data.find((entry) => entry.id === evalKey) ?? null)
    : null

  return {
    configured: input.evalCatalog.summary.configured,
    datasetSize: matchingEval?.datasetSize ?? null,
    evalKey,
    evalName: matchingEval?.name ?? null,
    evidenceRunId: input.latestVersion?.evalEvidence?.evalRunId ?? null,
    evidenceScoreAverage: input.latestVersion?.evalEvidence?.scoreAverage ?? null,
    evidenceStatus: input.latestVersion?.evalEvidence?.status ?? null,
    lastRunAt: matchingEval?.lastRunAt ?? null,
    lastRunAverageScore: matchingEval?.lastRunAverageScore ?? null,
    lastRunStatus: matchingEval?.lastRunStatus ?? null,
    scorerCount: matchingEval?.scorerCount ?? null,
  }
}

/**
 * 读取统一 AI 治理总览，连接 Prompt 版本、失败日志、人工 feedback 与 eval 目录摘要。
 */
export async function getAiGovernanceOverview(
  input: ListAiGovernanceOverviewInput,
): Promise<AiGovernanceOverview> {
  const [promptVersionList, promptLogs, feedbackList, evalCatalog] = await Promise.all([
    listPromptVersions({
      page: 1,
      pageSize: 500,
      promptKey: undefined,
      status: undefined,
    }),
    listOperationLogsByModule('ai_prompts'),
    listFeedback({
      accepted: undefined,
      auditLogId: undefined,
      page: 1,
      pageSize: 5,
      search: undefined,
      userAction: undefined,
    }),
    listAiEvals({
      page: 1,
      pageSize: 100,
    }),
  ])
  const groupedVersions = groupPromptVersionsByPromptKey(promptVersionList.data)
  const failureAggregateMap = createPromptFailureAggregateMap(promptLogs)
  const normalizedSearch = input.search?.trim().toLowerCase() ?? null
  const allReviewItems = [...groupedVersions.entries()]
    .filter(([promptKey]) =>
      normalizedSearch ? promptKey.toLowerCase().includes(normalizedSearch) : true,
    )
    .map(([promptKey, versions]) =>
      createGovernanceReviewItem({
        failureAggregate: failureAggregateMap.get(promptKey) ?? null,
        hasHumanOverride: feedbackList.summary.humanOverrideCount > 0,
        latestFeedbackAction: feedbackList.data[0]?.userAction ?? null,
        promptKey,
        versions,
      }),
    )
    .sort((left, right) => {
      const toneScore = { critical: 0, warning: 1, neutral: 2 }
      const toneDifference = toneScore[left.tone] - toneScore[right.tone]

      if (toneDifference !== 0) {
        return toneDifference
      }

      return right.latestVersion.updatedAt.localeCompare(left.latestVersion.updatedAt)
    })
  const pagedReviewItems = paginateArray(allReviewItems, input.page, input.pageSize)
  const rejectionEventCount = [...failureAggregateMap.values()].filter(
    (entry) => entry.latestKind === 'rejection',
  ).length
  const exceptionEventCount = [...failureAggregateMap.values()].filter(
    (entry) => entry.latestKind === 'exception',
  ).length

  return {
    pagination: createPagination(input.page, input.pageSize, allReviewItems.length),
    recentFeedback: feedbackList.data,
    reviewQueue: pagedReviewItems,
    summary: {
      activePromptKeys: [...groupedVersions.values()].filter((entries) =>
        entries.some((entry) => entry.isActive),
      ).length,
      evalConfigured: evalCatalog.summary.configured,
      exceptionEventCount,
      humanOverrideCount: feedbackList.summary.humanOverrideCount,
      promptFailureEvents: [...failureAggregateMap.values()].reduce(
        (totalCount, entry) => totalCount + entry.count,
        0,
      ),
      rejectionEventCount,
      releaseReadyPromptVersions: promptVersionList.summary.releaseReadyCount,
      totalEvalDatasets: evalCatalog.summary.totalDatasets,
      totalEvalExperiments: evalCatalog.summary.totalExperiments,
      totalPromptKeys: groupedVersions.size,
      totalPromptVersions: promptVersionList.pagination.total,
    },
  }
}

/**
 * 读取单个 Prompt 治理键的完整治理读模型，供工作台统一查看历史、门禁、失败与回滚。
 */
export async function getPromptGovernanceReview(
  input: GetPromptGovernanceReviewInput,
): Promise<PromptGovernanceReview> {
  const [overview, history, failureAudit, rollbackChain, evalCatalog] = await Promise.all([
    getAiGovernanceOverview({
      page: 1,
      pageSize: 500,
      search: input.promptKey,
    }),
    getPromptVersionHistoryEntry({
      promptKey: input.promptKey,
    }),
    getPromptGovernanceFailureAuditEntry({
      promptKey: input.promptKey,
    }),
    getPromptRollbackChainEntry({
      promptKey: input.promptKey,
    }),
    listAiEvals({
      page: 1,
      pageSize: 100,
    }),
  ])
  const reviewItem =
    overview.reviewQueue.find((entry) => entry.promptKey === input.promptKey) ?? null
  const latestVersion = history.versions[0] ?? null

  if (!reviewItem || !latestVersion) {
    throw new ORPCError('NOT_FOUND', {
      message: 'Prompt governance review not found',
    })
  }

  const [latestReleaseAudit, compareToPrevious] = await Promise.all([
    getPromptReleaseAuditEntry({
      id: latestVersion.id,
    }),
    history.versions[1]
      ? getPromptVersionCompareEntry({
          baselineId: history.versions[1].id,
          id: latestVersion.id,
        })
      : Promise.resolve(null),
  ])

  return {
    compareToPrevious,
    failureAudit,
    history,
    latestReleaseAudit,
    linkedEval: createLinkedEvalSnapshot({
      evalCatalog,
      latestVersion,
    }),
    promptKey: input.promptKey,
    reviewItem,
    rollbackChain,
  }
}

export const aiGovernanceOverviewProcedure = requireAnyPermission(aiGovernanceReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/governance/overview',
    tags: ['AI:Governance'],
    summary: '读取 AI 治理总览',
    description:
      '返回 Prompt review queue、人工 override、失败事件和 eval 摘要，供治理工作台统一消费。',
  })
  .input(listAiGovernanceOverviewInputSchema)
  .output(aiGovernanceOverviewSchema)
  .handler(async ({ input }) => getAiGovernanceOverview(input))

export const aiPromptGovernanceReviewProcedure = requireAnyPermission(aiGovernanceReadPermissions)
  .route({
    method: 'GET',
    path: '/api/v1/ai/governance/prompts/:promptKey',
    tags: ['AI:Governance'],
    summary: '读取单个 Prompt 治理读模型',
    description: '返回指定 Prompt 治理键的历史、失败、回滚、发布审计和评测绑定摘要。',
  })
  .input(getPromptGovernanceReviewInputSchema)
  .output(promptGovernanceReviewSchema)
  .handler(async ({ input }) => getPromptGovernanceReview(input))
