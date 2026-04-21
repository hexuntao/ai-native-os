import { Badge } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

export function CommandBar(): ReactNode {
  return (
    <div className="flex h-10 min-w-[15rem] items-center justify-between rounded-xl border border-border/80 bg-background px-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Search
        </span>
        <span className="text-sm text-muted-foreground">Agents, runs, prompts, traces…</span>
      </div>
      <Badge variant="secondary">⌘K</Badge>
    </div>
  )
}
