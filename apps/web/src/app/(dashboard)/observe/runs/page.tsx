import type { ReactNode } from 'react'

import { RunsWorkbenchPage } from '@/features/runs/components/runs-workbench-page'
import { createAiAuditFilterState, type DashboardSearchParams } from '@/lib/management'
import { loadAiAuditLogsList } from '@/lib/server-management'

interface ObserveRunsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function readSelectedAuditId(searchParams: DashboardSearchParams): string | null {
  const value = searchParams.auditId
  const normalizedValue = Array.isArray(value) ? value[0] : value

  return normalizedValue ?? null
}

export default async function ObserveRunsPage({
  searchParams,
}: ObserveRunsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiAuditFilterState(resolvedSearchParams)
  const payload = await loadAiAuditLogsList(filters)
  const selectedAuditId = readSelectedAuditId(resolvedSearchParams)

  return (
    <RunsWorkbenchPage
      filters={filters}
      payload={payload}
      resolvedSearchParams={resolvedSearchParams}
      selectedAuditId={selectedAuditId}
    />
  )
}
