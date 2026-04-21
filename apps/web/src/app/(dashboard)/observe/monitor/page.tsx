import type { ReactNode } from 'react'

import { RuntimeMonitorHubPage } from '@/features/monitor/components/runtime-monitor-hub-page'
import { loadOnlineUsersList, loadServerSummary } from '@/lib/server-management'

export default async function ObserveMonitorPage(): Promise<ReactNode> {
  const [serverSummary, onlinePayload] = await Promise.all([
    loadServerSummary(),
    loadOnlineUsersList({ page: 1, pageSize: 5, search: undefined }),
  ])

  return <RuntimeMonitorHubPage onlinePayload={onlinePayload} serverSummary={serverSummary} />
}
