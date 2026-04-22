'use client'

import type { CopilotBridgeSummary } from '@ai-native-os/shared'
import type { ReactNode } from 'react'
import * as React from 'react'
import type { AuthenticatedShellState } from '@/lib/api'
import type { NavigationGroup } from '@/lib/shell'

interface ShellContextValue {
  groupedNavigation: NavigationGroup[]
  initialBridgeSummary: CopilotBridgeSummary | null
  shellState: AuthenticatedShellState
}

const ShellContext = React.createContext<ShellContextValue | null>(null)

export function ShellProvider({
  children,
  groupedNavigation,
  initialBridgeSummary,
  shellState,
}: React.PropsWithChildren<ShellContextValue>): ReactNode {
  return (
    <ShellContext.Provider
      value={{
        groupedNavigation,
        initialBridgeSummary,
        shellState,
      }}
    >
      {children}
    </ShellContext.Provider>
  )
}

export function useShellContext(): ShellContextValue {
  const context = React.useContext(ShellContext)

  if (!context) {
    throw new Error('useShellContext must be used within ShellProvider.')
  }

  return context
}
