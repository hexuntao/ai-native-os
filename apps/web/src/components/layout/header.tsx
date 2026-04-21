'use client'

import { Badge, Button } from '@ai-native-os/ui'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import type { NavigationItem } from '@/config/nav-config'
import type { AuthenticatedShellState } from '@/lib/api'
import { resolveShellModuleLabel } from '@/lib/shell'
import { CommandBar } from './command-bar'
import { SidebarTrigger } from './sidebar'

interface HeaderProps {
  activeNavigationItem: NavigationItem | null
  assistantStatus: 'degraded' | 'offline' | 'ready'
  assistantToggleLabel: string
  onAssistantToggle: () => void
  shellState: AuthenticatedShellState
}

function resolveAssistantVariant(status: HeaderProps['assistantStatus']): 'accent' | 'secondary' {
  if (status === 'ready') {
    return 'accent'
  }

  return 'secondary'
}

export function Header({
  activeNavigationItem,
  assistantStatus,
  assistantToggleLabel,
  onAssistantToggle,
  shellState,
}: HeaderProps): ReactNode {
  const pathname = usePathname()
  const moduleLabel = resolveShellModuleLabel(pathname)
  const pageLabel = activeNavigationItem?.label ?? 'Operator Workspace'

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-background/95 backdrop-blur">
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
        <div className="hidden md:flex">
          <CommandBar />
        </div>
        <Badge variant="secondary">{shellState.roleCodes.join(', ')}</Badge>
        <Badge variant={resolveAssistantVariant(assistantStatus)}>
          assistant:{assistantStatus}
        </Badge>
        <Button onClick={onAssistantToggle} size="sm" type="button" variant="secondary">
          {assistantToggleLabel}
        </Button>
      </div>
    </header>
  )
}
