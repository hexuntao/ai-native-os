import type { ReactNode } from 'react'

import { PlaceholderPage } from '@/components/shell/placeholder-page'

export default function ReportsPage(): ReactNode {
  return (
    <PlaceholderPage
      eyebrow="Workflow Module"
      summary="The report workflow already exists in the backend. This placeholder route keeps the authenticated dashboard navigation coherent until report UIs land."
      title="Reports Export"
    />
  )
}
