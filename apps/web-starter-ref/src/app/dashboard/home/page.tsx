import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

import PageContainer from '@/components/layout/page-container'

export default function HomePage(): ReactNode {
  return (
    <PageContainer
      pageDescription="Starter baseline adapted into an AI-native operations shell."
      pageTitle="AI Operations Center"
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Active agents', '12', 'agents'],
            ['Degraded runs', '3', 'attention'],
            ['Eval regressions', '1', 'stable'],
            ['Pending approvals', '5', 'queue'],
          ].map(([label, value, badge]) => (
            <Card className="border-border/80 bg-card/96 shadow-[var(--shadow-soft)]" key={label}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="grid gap-1">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {label}
                  </p>
                  <CardTitle className="text-4xl">{value}</CardTitle>
                </div>
                <Badge variant="secondary">{badge}</Badge>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
          <Card className="border-border/80 bg-card/96 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Starter Migration Focus
              </p>
              <CardTitle className="text-2xl">Shell first, features second</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground">
              <p>
                This isolated app keeps the `next-shadcn-dashboard-starter` shell contract while
                replacing its product demos with AI-native control-plane vocabulary.
              </p>
              <p>
                The next migration step is to re-host real `home / observe / govern` screens here,
                then retire the duplicated shell logic in the current `apps/web`.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/96 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Starter Cleanup
              </p>
              <CardTitle className="text-2xl">Demo surfaces removed</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground">
              <p>No billing, kanban, product, chat, or form showcase routes are carried over.</p>
              <p>
                Navigation, header, sidebar, and right info rail remain as the migration baseline.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
