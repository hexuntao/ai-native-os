import type { ReactNode } from 'react'

import { PlaceholderPage } from '@/components/shell/placeholder-page'

export default function SystemPermissionsPage(): ReactNode {
  return (
    <PlaceholderPage
      eyebrow="System Module"
      summary="Permission editing is intentionally not implemented in P4-T1. This page exists so the new dashboard shell can route without falling back to 404."
      title="Permission Center"
    />
  )
}
