import type { ReactNode } from 'react'

import { PlaceholderPage } from '@/components/shell/placeholder-page'

export default function SystemRolesPage(): ReactNode {
  return (
    <PlaceholderPage
      eyebrow="System Module"
      milestones={[
        'Bind role list to contract-first users/roles API.',
        'Render permission inheritance matrix with search and filters.',
        'Add create/edit flows gated by CASL abilities.',
      ]}
      rows={[
        {
          label: 'Role matrix shell',
          note: 'Dashboard route and shared table primitives are ready.',
          status: 'ready',
        },
        {
          label: 'Role CRUD actions',
          note: 'Deferred to P4-T3 after system API routes are exposed.',
          status: 'blocked',
        },
        {
          label: 'Permission inheritance view',
          note: 'Requires contract-first role/permission resources.',
          status: 'scaffolded',
        },
      ]}
      summary="Phase 4 currently establishes the Next.js dashboard shell. The full contract-first roles matrix screen lands in P4-T3."
      title="Roles Matrix"
    />
  )
}
