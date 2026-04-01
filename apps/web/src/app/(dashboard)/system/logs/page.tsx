import type { ReactNode } from 'react'

import { PlaceholderPage } from '@/components/shell/placeholder-page'

export default function SystemLogsPage(): ReactNode {
  return (
    <PlaceholderPage
      eyebrow="Monitor Module"
      milestones={[
        'Bind operation log and AI audit endpoints.',
        'Add actor, route, and correlation filters.',
        'Expose trace drill-down once observability pipelines land.',
      ]}
      rows={[
        {
          label: 'Authenticated route',
          note: 'Navigation and page shell already work with ability filtering.',
          status: 'ready',
        },
        {
          label: 'Audit stream table',
          note: 'Waiting on P4-T4 monitor module work.',
          status: 'blocked',
        },
        {
          label: 'Trace correlation UX',
          note: 'Depends on Phase 5 telemetry surfaces.',
          status: 'scaffolded',
        },
      ]}
      summary="Audit and operation log pages are deferred until the monitor surfaces in P4-T4, but navigation and authenticated shell routing are now stable."
      title="Audit Trails"
    />
  )
}
