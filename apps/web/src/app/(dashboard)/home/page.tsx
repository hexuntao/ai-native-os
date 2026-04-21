import type { ReactNode } from 'react'

import { AiOperationsCenterPage } from '@/features/home/components/ai-operations-center-page'
import {
  loadAiAuditLogsList,
  loadAiEvalsList,
  loadAiGovernanceOverview,
  loadServerSummary,
} from '@/lib/server-management'

export default async function HomePage(): Promise<ReactNode> {
  const [serverSummary, governanceOverview, evalPayload, auditPayload] = await Promise.all([
    loadServerSummary(),
    loadAiGovernanceOverview({ page: 1, pageSize: 5, search: undefined }),
    loadAiEvalsList({ page: 1, pageSize: 5, search: undefined }),
    loadAiAuditLogsList({
      page: 1,
      pageSize: 5,
      search: undefined,
      status: 'all',
      toolId: undefined,
    }),
  ])

  return (
    <AiOperationsCenterPage
      auditPayload={auditPayload}
      evalPayload={evalPayload}
      governanceOverview={governanceOverview}
      serverSummary={serverSummary}
    />
  )
}
