'use client'

import { Badge, Button } from '@ai-native-os/ui'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { resolveBreadcrumb } from '@/lib/navigation'

export default function Header(): ReactNode {
  const pathname = usePathname()
  const { moduleLabel, pageLabel } = resolveBreadcrumb(pathname)

  return (
    <header className="bg-background sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/80">
      <div className="flex min-w-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="mr-2 hidden h-4 w-px bg-border sm:block" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm text-muted-foreground">{moduleLabel}</span>
          <span className="text-muted-foreground">/</span>
          <span className="truncate text-sm font-medium text-foreground">{pageLabel}</span>
        </nav>
      </div>

      <div className="flex items-center gap-2 px-4">
        <div className="hidden items-center gap-3 rounded-full border border-border/80 bg-background px-4 py-2 shadow-sm md:flex">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Search
          </span>
          <span className="text-sm text-muted-foreground">Agents, runs, prompts, traces…</span>
          <Badge variant="secondary">⌘K</Badge>
        </div>
        <Badge variant="secondary">starter-ref</Badge>
        <Button size="sm" type="button" variant="secondary">
          Shell Only
        </Button>
      </div>
    </header>
  )
}
