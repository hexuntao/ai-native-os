'use client'

import { Badge, Button } from '@ai-native-os/ui'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import type { NavigationItem } from '@/config/nav-config'
import type { AuthenticatedShellState } from '@/lib/api'
import { isNavigationItemActive, resolveShellModuleLabel } from '@/lib/shell'
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

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-[rgba(248,250,252,0.88)] backdrop-blur-md">
      <div className="grid gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {resolveShellModuleLabel(pathname)}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {activeNavigationItem?.label ?? 'Operator Workspace'}
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {activeNavigationItem?.description ??
                'Operate AI-native runtime, governance, and administration surfaces from one authenticated shell.'}
            </p>
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <CommandBar />
          <div className="flex flex-wrap gap-2 xl:hidden">
            {shellState.visibleNavigation.map((item) => (
              <Link
                className={
                  isNavigationItemActive(item.href, pathname)
                    ? 'rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground'
                    : 'rounded-full border border-border/80 bg-card/90 px-3 py-2 text-sm text-muted-foreground'
                }
                href={item.href as Route}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
