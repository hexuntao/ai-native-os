import type { ReactNode } from 'react'

import PageContainer from '@/components/layout/page-container'

interface PlaceholderPageProps {
  params: Promise<{
    segments: string[]
  }>
}

function formatTitle(segments: readonly string[]): string {
  return segments.map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1)).join(' / ')
}

export default async function PlaceholderPage({
  params,
}: PlaceholderPageProps): Promise<ReactNode> {
  const { segments } = await params

  return (
    <PageContainer
      pageDescription="Starter-derived placeholder that marks the next migration target."
      pageTitle={formatTitle(segments)}
    >
      <div className="rounded-[var(--radius-xl)] border border-border/80 bg-card/96 p-6 shadow-[var(--shadow-soft)]">
        <p className="text-sm leading-7 text-muted-foreground">
          This route is intentionally minimal. The shell is the migration target; functional AI
          workbench content will be ported here after the shell contract is accepted.
        </p>
      </div>
    </PageContainer>
  )
}
