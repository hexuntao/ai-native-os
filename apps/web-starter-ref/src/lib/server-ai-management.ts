import type { AiAuditListResponse } from '@ai-native-os/shared'
import { triggerJobCatalog } from '@ai-native-os/shared'
import { cookies } from 'next/headers'
import {
  type AiAuditFilterState,
  type DashboardListFilters,
  fetchAiAuditLogsList,
  fetchAiEvalsList,
  fetchAiGovernanceOverview,
  fetchServerSummary,
} from '@/lib/ai-management'
import { resolveWebEnvironment } from '@/lib/env'

async function readCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.toString() || undefined
}

export interface ReportWorkspaceEntry {
  label: string
  source: 'schedule-task' | 'workflow'
  value: AiAuditListResponse['data'][number]
}

export interface ReportWorkspaceReadModel {
  exportHistory: ReportWorkspaceEntry[]
  latestExport: ReportWorkspaceEntry | null
  latestRun: ReportWorkspaceEntry | null
  schedule: (typeof triggerJobCatalog)[number]
}

export async function loadServerSummary() {
  return fetchServerSummary(await readCookieHeader(), resolveWebEnvironment())
}

export async function loadAiEvalsList(filters: DashboardListFilters) {
  return fetchAiEvalsList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadAiAuditLogsList(filters: AiAuditFilterState) {
  return fetchAiAuditLogsList(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadAiGovernanceOverview(filters: DashboardListFilters) {
  return fetchAiGovernanceOverview(await readCookieHeader(), resolveWebEnvironment(), filters)
}

export async function loadReportWorkspace(): Promise<ReportWorkspaceReadModel> {
  const [workflowPayload, schedulePayload] = await Promise.all([
    loadAiAuditLogsList({
      page: 1,
      pageSize: 6,
      search: undefined,
      status: 'all',
      toolId: 'workflow:report-schedule',
    }),
    loadAiAuditLogsList({
      page: 1,
      pageSize: 6,
      search: undefined,
      status: 'all',
      toolId: 'task:report-schedule-trigger',
    }),
  ])

  const exportHistory = [
    ...workflowPayload.data.map((value) => ({
      label: 'Workflow execution',
      source: 'workflow' as const,
      value,
    })),
    ...schedulePayload.data.map((value) => ({
      label: 'Scheduled trigger',
      source: 'schedule-task' as const,
      value,
    })),
  ].toSorted((left, right) => {
    return new Date(right.value.createdAt).getTime() - new Date(left.value.createdAt).getTime()
  })

  const schedule =
    triggerJobCatalog.find((job) => job.id === 'report-schedule-trigger') ?? triggerJobCatalog[0]

  return {
    exportHistory,
    latestExport:
      exportHistory.find(
        (entry) => entry.value.status === 'success' && entry.source === 'workflow',
      ) ??
      exportHistory.find((entry) => entry.value.status === 'success') ??
      null,
    latestRun: exportHistory[0] ?? null,
    schedule,
  }
}
