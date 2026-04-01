import type { ReactNode } from 'react'

import { PlaceholderPage } from '@/components/shell/placeholder-page'

export default function AiKnowledgePage(): ReactNode {
  return (
    <PlaceholderPage
      eyebrow="AI Module"
      milestones={[
        'List indexed knowledge assets with retrieval metadata.',
        'Support re-index triggers and semantic search previews.',
        'Expose prompt and citation context once AI admin pages land.',
      ]}
      rows={[
        {
          label: 'Knowledge route shell',
          note: 'Route is reachable and protected behind current ability rules.',
          status: 'ready',
        },
        {
          label: 'RAG index overview',
          note: 'Waiting on P4-T4 AI management pages.',
          status: 'blocked',
        },
        {
          label: 'Semantic search preview',
          note: 'Shared dialog/table primitives are ready to host search results.',
          status: 'scaffolded',
        },
      ]}
      summary="RAG and knowledge retrieval APIs are ready from Phase 3. The management surface is queued for P4-T4 after the dashboard shell baseline is complete."
      title="Knowledge Vault"
    />
  )
}
