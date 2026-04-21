import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

export function InfoSidebar(): ReactNode {
  return (
    <aside className="hidden border-l border-border/80 bg-background/90 p-4 backdrop-blur xl:flex xl:w-96 xl:flex-col">
      <div className="sticky top-20 grid gap-4">
        <Card className="border-border/80 bg-card/96 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Starter Ref
            </p>
            <CardTitle className="text-2xl">Info Sidebar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7 text-muted-foreground">
            <p>
              This rail intentionally mirrors the starter's right-hand information column and is
              reserved for future object context, documentation, and Copilot handoff content.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">shell</Badge>
              <Badge variant="secondary">migration</Badge>
              <Badge variant="secondary">reference</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </aside>
  )
}
