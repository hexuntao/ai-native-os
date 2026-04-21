'use client'

import { Badge, Button } from '@ai-native-os/ui'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import type { NavigationItem } from '@/config/nav-config'
import type { AuthenticatedShellState } from '@/lib/api'
import { resolveShellModuleLabel } from '@/lib/shell'
import { CommandBar } from './command-bar'

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

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden h-4 w-px bg-border md:block" />
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {moduleLabel}
          </p>
          <p className="truncate text-sm font-medium text-foreground">
            {activeNavigationItem?.label ?? 'Operator Workspace'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden xl:block">
          <CommandBar />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{shellState.roleCodes.join(', ')}</Badge>
          <Badge variant={resolveAssistantVariant(assistantStatus)}>
            assistant:{assistantStatus}
          </Badge>
          <Button onClick={onAssistantToggle} type="button" variant="secondary">
            {assistantToggleLabel}
          </Button>
        </div>
      </div>
    </header>
  )
}
