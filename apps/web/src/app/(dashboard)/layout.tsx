import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { DashboardShell } from '@/components/shell/dashboard-shell'
import { loadCurrentShellState } from '@/lib/server-shell'

interface DashboardLayoutProps {
  children: ReactNode
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps): Promise<ReactNode> {
  const shellState = await loadCurrentShellState()

  if (shellState.kind !== 'authenticated') {
    redirect('/')
  }

  return <DashboardShell shellState={shellState}>{children}</DashboardShell>
}
