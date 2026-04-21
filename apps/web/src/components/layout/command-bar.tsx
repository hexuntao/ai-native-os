import { Badge } from '@ai-native-os/ui'
import type { ReactNode } from 'react'

export function CommandBar(): ReactNode {
  return (
    <div className="flex h-11 min-w-[16rem] items-center justify-between rounded-[var(--radius-lg)] border border-border/80 bg-card/85 px-4 shadow-[var(--shadow-soft)]">
      <div className="grid gap-0.5">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Command Search
        </span>
        <span className="text-sm text-foreground">Search agents, runs, prompts, traces…</span>
      </div>
      <Badge variant="secondary">⌘K</Badge>
    </div>
  )
}
