import type { ReactNode } from 'react'

import { PlaceholderPage } from '@/components/shell/placeholder-page'

export default function SystemPermissionsPage(): ReactNode {
  return (
    <PlaceholderPage
      eyebrow="System Module"
      milestones={[
        'Bind role-permission contracts to editable tables.',
        'Render ability condition and field scopes.',
        'Protect mutation flows with super-admin policies.',
      ]}
      rows={[
        {
          label: 'Permission route shell',
          note: 'Protected navigation is active and no longer falls through to 404.',
          status: 'ready',
        },
        {
          label: 'Editable topology grid',
          note: 'Blocked on system management module implementation.',
          status: 'blocked',
        },
        {
          label: 'Condition inspector',
          note: 'Shared dialog primitive is ready for future policy drill-down.',
          status: 'scaffolded',
        },
      ]}
      summary="Permission editing is intentionally not implemented in P4-T1. This page exists so the new dashboard shell can route without falling back to 404."
      title="Permission Center"
    />
  )
}
