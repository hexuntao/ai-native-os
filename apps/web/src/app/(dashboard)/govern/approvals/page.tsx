import type { ReactNode } from 'react'

import { ApprovalsWorkbenchPage } from '@/features/approvals/components/approvals-workbench-page'
import { createAiGovernanceFilterState, type DashboardSearchParams } from '@/lib/management'
import { loadAiGovernanceOverview, loadPromptGovernanceReview } from '@/lib/server-management'

interface GovernApprovalsPageProps {
  searchParams: Promise<DashboardSearchParams>
}

function resolveSelectedPromptKey(
  searchParams: DashboardSearchParams,
  promptKeys: readonly string[],
): string | null {
  const value = searchParams.promptKey
  const normalizedValue = Array.isArray(value) ? value[0] : value

  if (normalizedValue && promptKeys.includes(normalizedValue)) {
    return normalizedValue
  }

  return promptKeys[0] ?? null
}

export default async function GovernApprovalsPage({
  searchParams,
}: GovernApprovalsPageProps): Promise<ReactNode> {
  const resolvedSearchParams = await searchParams
  const filters = createAiGovernanceFilterState(resolvedSearchParams)
  const overview = await loadAiGovernanceOverview(filters)
  const selectedPromptKey = resolveSelectedPromptKey(
    resolvedSearchParams,
    overview.reviewQueue.map((entry) => entry.promptKey),
  )
  const selectedReview = selectedPromptKey
    ? await loadPromptGovernanceReview(selectedPromptKey)
    : null

  return (
    <ApprovalsWorkbenchPage
      filters={filters}
      overview={overview}
      resolvedSearchParams={resolvedSearchParams}
      selectedPromptKey={selectedPromptKey}
      selectedReview={selectedReview}
    />
  )
}
