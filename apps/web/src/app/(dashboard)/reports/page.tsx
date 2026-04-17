import type { ReactNode } from 'react'

import { AssistantHandoffCard } from '@/components/management/page-feedback'
import { PlaceholderPage } from '@/components/shell/placeholder-page'
import { resolveCopilotPageHandoff } from '@/lib/copilot'

export default function ReportsPage(): ReactNode {
  const assistantHandoff = resolveCopilotPageHandoff('/reports')

  return (
    <PlaceholderPage
      assistantHandoff={
        assistantHandoff ? (
          <AssistantHandoffCard
            badge={assistantHandoff.badge}
            description={assistantHandoff.summary}
            note={assistantHandoff.note}
            prompts={assistantHandoff.prompts}
            title={assistantHandoff.title}
          />
        ) : undefined
      }
      eyebrow="Workflow Module"
      milestones={[
        'Connect report schedule workflow status to the page.',
        'Expose export history and latest snapshot metadata.',
        'Enable copilot-triggered report actions in P4-T5.',
      ]}
      rows={[
        {
          label: 'Report route shell',
          note: 'Authenticated route is live and shares the new design system primitives.',
          status: 'ready',
        },
        {
          label: 'Export history table',
          note: 'Blocked on workflow-facing UI work.',
          status: 'blocked',
        },
        {
          label: 'Copilot action hook',
          note: 'Unlocks after the sidebar/chat experience lands in P4-T5.',
          status: 'scaffolded',
        },
      ]}
      summary="The report workflow already exists in the backend. This placeholder route keeps the authenticated dashboard navigation coherent until report UIs land."
      title="Reports Export"
    />
  )
}
