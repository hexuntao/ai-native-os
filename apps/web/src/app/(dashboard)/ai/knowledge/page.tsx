import type { ReactNode } from 'react'

import { PlaceholderPage } from '@/components/shell/placeholder-page'

export default function AiKnowledgePage(): ReactNode {
  return (
    <PlaceholderPage
      eyebrow="AI Module"
      summary="RAG and knowledge retrieval APIs are ready from Phase 3. The management surface is queued for P4-T4 after the dashboard shell baseline is complete."
      title="Knowledge Vault"
    />
  )
}
